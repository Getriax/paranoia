import { Injectable, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import { dragonfly } from '../db/dragonfly.js';
import { game, message, player, topic } from '../db/schema.js';
import { ModifierService } from '../modifier/modifier.service.js';
import type { TranscriptEntry } from '../modifier/modifier.types.js';
import {
  ServerEvents,
  type GameMessagePayload,
  type GameMessageReceivedPayload,
  type GameYourTurnPayload,
  type GameVotingPhasePayload,
} from '@openclaw/shared';

@Injectable()
export class GameService {
  private readonly logger = new Logger(GameService.name);

  constructor(private readonly modifier: ModifierService) {}

  async handleMessage(
    server: Server,
    socket: Socket,
    payload: GameMessagePayload,
  ): Promise<void> {
    const playerData = socket.data?.player as
      | typeof player.$inferSelect
      | undefined;
    const gameData = socket.data?.game as typeof game.$inferSelect | undefined;
    if (!playerData || !gameData) {
      socket.emit(ServerEvents.ERROR, {
        code: 'UNAUTHORIZED',
        message: 'No active session',
      });
      return;
    }

    const lockKey = `lock:turn:${gameData.id}`;
    const lockToken = `${playerData.id}:${Date.now()}`;
    const acquired = await dragonfly.set(lockKey, lockToken, 'EX', 5, 'NX');
    if (acquired !== 'OK') {
      socket.emit(ServerEvents.ERROR, {
        code: 'TURN_LOCK_BUSY',
        message: 'Another turn is being processed',
      });
      return;
    }

    try {
      const [currentGame] = await db
        .select()
        .from(game)
        .where(eq(game.id, gameData.id))
        .limit(1);
      if (!currentGame) {
        socket.emit(ServerEvents.ERROR, {
          code: 'GAME_NOT_FOUND',
          message: 'Game no longer exists',
        });
        return;
      }

      if (currentGame.status !== 'playing') {
        socket.emit(ServerEvents.ERROR, {
          code: 'GAME_NOT_PLAYING',
          message: `Game is in ${currentGame.status} state`,
        });
        return;
      }

      if (currentGame.currentPlayerId !== playerData.id) {
        socket.emit(ServerEvents.ERROR, {
          code: 'NOT_YOUR_TURN',
          message: 'It is not your turn',
        });
        return;
      }

      const players = await db
        .select()
        .from(player)
        .where(eq(player.gameId, gameData.id));
      const opponent = players.find((p) => p.id !== playerData.id);
      if (!opponent) {
        socket.emit(ServerEvents.ERROR, {
          code: 'NO_OPPONENT',
          message: 'Opponent not found',
        });
        return;
      }

      const priorMessages = await db
        .select()
        .from(message)
        .where(eq(message.gameId, gameData.id))
        .orderBy(message.turnNumber);
      const turnNumber = priorMessages.length + 1;
      const totalMessages = currentGame.totalTurns * 2;

      const [topicRow] = currentGame.topicId
        ? await db
            .select()
            .from(topic)
            .where(eq(topic.id, currentGame.topicId))
            .limit(1)
        : [undefined];

      const transcript: TranscriptEntry[] = priorMessages.map((m) => {
        const speaker = players.find((p) => p.id === m.playerId);
        return {
          playerId: m.playerId,
          nickname: speaker?.displayName ?? 'unknown',
          text: m.deliveredText,
          turnNumber: m.turnNumber,
        };
      });

      const modificationsSoFar = priorMessages.filter(
        (m) => m.wasModified,
      ).length;

      const decision = await this.modifier.modify({
        topic: topicRow?.text ?? '',
        transcript,
        currentTurnNumber: turnNumber,
        totalTurns: currentGame.totalTurns,
        modificationsSoFar,
        currentMessage: payload.text,
        currentPlayerNickname: playerData.displayName,
        promptId: currentGame.promptId ?? '',
        model: currentGame.model,
      });

      const [inserted] = await db
        .insert(message)
        .values({
          gameId: gameData.id,
          playerId: playerData.id,
          turnNumber,
          originalText: payload.text,
          deliveredText: decision.deliveredText,
          wasModified: decision.wasModified,
          modifierDecision: decision as unknown as Record<string, unknown>,
          modifierLatencyMs: decision.latencyMs,
          modifierTokensIn: decision.inputTokens,
          modifierTokensOut: decision.outputTokens,
        })
        .returning();
      if (!inserted) throw new Error('message insert returned no row');

      const room = `game:${gameData.id}`;
      const broadcast: GameMessageReceivedPayload = {
        messageId: inserted.id,
        fromPlayerId: playerData.id,
        text: decision.deliveredText,
        turnNumber,
      };
      socket.to(room).emit(ServerEvents.GAME_MESSAGE_RECEIVED, broadcast);
      socket.emit(ServerEvents.GAME_MESSAGE_RECEIVED, broadcast);

      if (turnNumber >= totalMessages) {
        await db
          .update(game)
          .set({
            status: 'voting',
            currentPlayerId: null,
            updatedAt: new Date(),
          })
          .where(eq(game.id, gameData.id));

        const allMessages = [...priorMessages, inserted];
        const votingPayload: GameVotingPhasePayload = {
          messages: allMessages.map((m) => ({
            id: m.id,
            text: m.deliveredText,
            fromPlayerId: m.playerId,
            turnNumber: m.turnNumber,
          })),
        };
        server.to(room).emit(ServerEvents.GAME_VOTING_PHASE, votingPayload);
        for (const sock of await server.in(room).fetchSockets()) {
          if (sock.data?.game) {
            sock.data.game = { ...sock.data.game, status: 'voting' };
          }
        }
        this.logger.log(
          `game ${gameData.id} → voting (total=${allMessages.length})`,
        );
      } else {
        await db
          .update(game)
          .set({
            currentPlayerId: opponent.id,
            updatedAt: new Date(),
          })
          .where(eq(game.id, gameData.id));

        const yourTurn: GameYourTurnPayload = {
          turnNumber: turnNumber + 1,
          remainingTurns: totalMessages - turnNumber,
        };
        for (const sock of await server.in(room).fetchSockets()) {
          if (sock.data?.game) {
            sock.data.game = {
              ...sock.data.game,
              currentPlayerId: opponent.id,
            };
          }
        }
        setTimeout(() => {
          void (async () => {
            for (const sock of await server.in(room).fetchSockets()) {
              if (sock.data?.player?.id === opponent.id) {
                sock.emit(ServerEvents.GAME_YOUR_TURN, yourTurn);
              }
            }
          })();
        }, 50);
      }
    } finally {
      const stored = await dragonfly.get(lockKey);
      if (stored === lockToken) {
        await dragonfly.del(lockKey);
      }
    }
  }
}
