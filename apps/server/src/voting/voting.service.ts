import { Injectable, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../db/client.js';
import { game, message, player, vote } from '../db/schema.js';
import {
  ServerEvents,
  type VoteSubmitPayload,
  type GameOpponentVotingPayload,
  type GameResultsPayload,
} from '@openclaw/shared';
import { EngagementService } from '../engagement/engagement.service.js';

const ENGAGEMENT_PLACEHOLDER = 0.5;
const DECEPTION_WEIGHT = 0.6;
const ENGAGEMENT_WEIGHT = 0.4;

@Injectable()
export class VotingService {
  private readonly logger = new Logger(VotingService.name);

  constructor(private readonly engagementService: EngagementService) {}

  async submitVotes(
    server: Server,
    socket: Socket,
    payload: VoteSubmitPayload,
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
    if (currentGame.status !== 'voting') {
      socket.emit(ServerEvents.ERROR, {
        code: 'NOT_VOTING_PHASE',
        message: `Game is in ${currentGame.status} state`,
      });
      return;
    }

    const messageIds = payload.votes.map((v) => v.messageId);
    const messages = await db
      .select()
      .from(message)
      .where(inArray(message.id, messageIds));

    const allBelongToGame = messages.every((m) => m.gameId === gameData.id);
    if (!allBelongToGame || messages.length !== messageIds.length) {
      socket.emit(ServerEvents.ERROR, {
        code: 'INVALID_VOTE_TARGET',
        message: 'Some messages do not belong to this game',
      });
      return;
    }

    const ownMessage = messages.find((m) => m.playerId === playerData.id);
    if (ownMessage) {
      socket.emit(ServerEvents.ERROR, {
        code: 'CANNOT_VOTE_OWN',
        message: 'Cannot vote on your own messages',
      });
      return;
    }

    const existing = await db
      .select()
      .from(vote)
      .where(eq(vote.voterPlayerId, playerData.id));
    const existingForThisGame = existing.filter((v) =>
      messageIds.includes(v.messageId),
    );
    if (existingForThisGame.length > 0) {
      socket.emit(ServerEvents.ERROR, {
        code: 'ALREADY_VOTED',
        message: 'You have already submitted votes',
      });
      return;
    }

    await db.insert(vote).values(
      payload.votes.map((v) => ({
        messageId: v.messageId,
        voterPlayerId: playerData.id,
        guess: v.guessedModified,
      })),
    );

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

    const allMessages = await db
      .select()
      .from(message)
      .where(eq(message.gameId, gameData.id))
      .orderBy(message.turnNumber);
    const opponentMessages = allMessages.filter(
      (m) => m.playerId === opponent.id,
    );
    const allVotes = await db
      .select()
      .from(vote)
      .where(
        inArray(
          vote.messageId,
          allMessages.map((m) => m.id),
        ),
      );

    const opponentVotedCount = allVotes.filter(
      (v) => v.voterPlayerId === opponent.id,
    ).length;
    const myMessages = allMessages.filter((m) => m.playerId === playerData.id);
    const opponentExpectedVotes = myMessages.length;

    const room = `game:${gameData.id}`;

    if (opponentVotedCount >= opponentExpectedVotes && opponentExpectedVotes > 0) {
      const finalize = await this.finalize(
        gameData.id,
        players,
        allMessages,
        allVotes,
      );

      const sockets = await server.in(room).fetchSockets();
      for (const sock of sockets) {
        const sockPlayer = sock.data?.player as
          | typeof player.$inferSelect
          | undefined;
        if (!sockPlayer) continue;
        const score = finalize.scores[sockPlayer.id] ?? 0;
        const surveyPending = !finalize.surveysSubmitted.has(sockPlayer.id);
        const opponentPending = !finalize.surveysSubmitted.has(
          finalize.opponentMap[sockPlayer.id] ?? '',
        );
        const results: GameResultsPayload = {
          messages: allMessages.map((m) => ({
            id: m.id,
            playerId: m.playerId,
            turnNumber: m.turnNumber,
            originalText: m.originalText,
            deliveredText: m.deliveredText,
            wasModified: m.wasModified,
          })),
          votes: allVotes.map((v) => ({
            messageId: v.messageId,
            voterPlayerId: v.voterPlayerId,
            guess: v.guess,
          })),
          score,
          opponentSurveyPending: opponentPending && !surveyPending,
        };
        sock.emit(ServerEvents.GAME_RESULTS, results);
        if (sock.data?.game) {
          sock.data.game = { ...sock.data.game, status: 'finished' };
        }
      }

      this.logger.log(
        `game ${gameData.id} → finished, scores=${JSON.stringify(finalize.scores)}`,
      );

      try {
        this.engagementService.scheduleAnalysis(gameData.id);
      } catch (err) {
        this.logger.error(
          `engagement schedule failed for game ${gameData.id}: ${String(err)}`,
        );
      }
    } else {
      const oppPayload: GameOpponentVotingPayload = { submitted: true };
      socket.to(room).emit(ServerEvents.GAME_OPPONENT_VOTING, oppPayload);
      this.logger.log(
        `vote:submit player=${playerData.id} gameId=${gameData.id} count=${payload.votes.length} (waiting opponent)`,
      );
    }
  }

  private async finalize(
    gameId: string,
    players: (typeof player.$inferSelect)[],
    allMessages: (typeof message.$inferSelect)[],
    allVotes: (typeof vote.$inferSelect)[],
  ): Promise<{
    scores: Record<string, number>;
    surveysSubmitted: Set<string>;
    opponentMap: Record<string, string>;
  }> {
    const scores: Record<string, number> = {};
    const opponentMap: Record<string, string> = {};

    if (players.length === 2) {
      opponentMap[players[0]!.id] = players[1]!.id;
      opponentMap[players[1]!.id] = players[0]!.id;
    }

    for (const p of players) {
      const myMessages = allMessages.filter((m) => m.playerId === p.id);
      const opponentId = opponentMap[p.id];
      const oppVotesOnMine = allVotes.filter(
        (v) =>
          v.voterPlayerId === opponentId &&
          myMessages.some((m) => m.id === v.messageId),
      );
      const wrongCount = oppVotesOnMine.filter((v) => {
        const target = myMessages.find((m) => m.id === v.messageId);
        if (!target) return false;
        return v.guess !== target.wasModified;
      }).length;
      const deceptionRate =
        myMessages.length === 0 ? 0 : wrongCount / myMessages.length;
      const composite =
        DECEPTION_WEIGHT * deceptionRate +
        ENGAGEMENT_WEIGHT * ENGAGEMENT_PLACEHOLDER;
      scores[p.id] = Math.round(composite * 1000) / 1000;
    }

    await db.transaction(async (tx) => {
      await tx
        .update(game)
        .set({ status: 'finished', updatedAt: new Date() })
        .where(eq(game.id, gameId));
      for (const p of players) {
        await tx
          .update(player)
          .set({ score: String(scores[p.id] ?? 0) })
          .where(eq(player.id, p.id));
      }
    });

    return { scores, surveysSubmitted: new Set<string>(), opponentMap };
  }
}
