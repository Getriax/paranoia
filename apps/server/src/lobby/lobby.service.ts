import { Injectable, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { game, player, prompt, topic } from '../db/schema.js';
import { SessionService } from '../session/session.service.js';
import { generateRoomCode, generateSessionToken } from './room-code.js';
import {
  ServerEvents,
  type LobbyCreatePayload,
  type LobbyJoinPayload,
  type LobbyCreatedPayload,
  type LobbyJoinedPayload,
  type LobbyPlayerJoinedPayload,
  type GameStartedPayload,
  type GameYourTurnPayload,
} from '@openclaw/shared';

const DEFAULT_MODEL =
  process.env.MODIFIER_DEFAULT_MODEL ?? 'deepseek/deepseek-v4-flash';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);

  constructor(private readonly sessionService: SessionService) {}

  async createLobby(
    socket: Socket,
    payload: LobbyCreatePayload,
  ): Promise<void> {
    const totalTurns = payload.settings.turns;
    const category = payload.settings.category;

    const topicRow = await this.pickTopic(category);
    if (!topicRow) {
      socket.emit(ServerEvents.ERROR, {
        code: 'NO_TOPICS',
        message: 'No topics available for this category',
      });
      return;
    }

    const sessionToken = generateSessionToken();
    let createdGameId: string | null = null;
    let createdPlayerId: string | null = null;
    let roomCode = '';

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const candidate = generateRoomCode();
      try {
        const result = await db.transaction(async (tx) => {
          const [g] = await tx
            .insert(game)
            .values({
              roomCode: candidate,
              topicId: topicRow.id,
              status: 'lobby',
              totalTurns,
              model: DEFAULT_MODEL,
            })
            .returning();
          if (!g) throw new Error('game insert returned no row');

          const [p] = await tx
            .insert(player)
            .values({
              gameId: g.id,
              displayName: payload.nickname,
              position: 0,
              sessionToken,
            })
            .returning();
          if (!p) throw new Error('player insert returned no row');

          await tx
            .update(game)
            .set({ currentPlayerId: p.id, updatedAt: new Date() })
            .where(eq(game.id, g.id));

          return { gameId: g.id, playerId: p.id };
        });

        createdGameId = result.gameId;
        createdPlayerId = result.playerId;
        roomCode = candidate;
        break;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes('room_code') || msg.includes('unique')) {
          this.logger.warn(`room code collision on ${candidate}, retrying`);
          continue;
        }
        throw err;
      }
    }

    if (!createdGameId || !createdPlayerId) {
      socket.emit(ServerEvents.ERROR, {
        code: 'ROOM_CODE_EXHAUSTED',
        message: 'Could not allocate a unique room code',
      });
      return;
    }

    await this.sessionService.cacheSession(
      sessionToken,
      createdPlayerId,
      createdGameId,
    );

    const [gameRow] = await db
      .select()
      .from(game)
      .where(eq(game.id, createdGameId))
      .limit(1);
    const [playerRow] = await db
      .select()
      .from(player)
      .where(eq(player.id, createdPlayerId))
      .limit(1);

    if (gameRow && playerRow) {
      socket.data.game = gameRow;
      socket.data.player = playerRow;
    }

    const room = `game:${createdGameId}`;
    await socket.join(room);

    const created: LobbyCreatedPayload = {
      roomCode,
      gameId: createdGameId,
      playerId: createdPlayerId,
      sessionToken,
    };
    socket.emit(ServerEvents.LOBBY_CREATED, created);

    this.logger.log(
      `lobby:created roomCode=${roomCode} gameId=${createdGameId} host=${payload.nickname}`,
    );
  }

  async joinLobby(
    server: Server,
    socket: Socket,
    payload: LobbyJoinPayload,
  ): Promise<void> {
    const code = payload.roomCode.toUpperCase();
    const [gameRow] = await db
      .select()
      .from(game)
      .where(eq(game.roomCode, code))
      .limit(1);

    if (!gameRow) {
      socket.emit(ServerEvents.ERROR, {
        code: 'ROOM_NOT_FOUND',
        message: 'No game with that room code',
      });
      return;
    }

    if (gameRow.status !== 'lobby') {
      socket.emit(ServerEvents.ERROR, {
        code: 'ROOM_NOT_JOINABLE',
        message: `Game is in ${gameRow.status} state, cannot join`,
      });
      return;
    }

    const players = await db
      .select()
      .from(player)
      .where(eq(player.gameId, gameRow.id));
    if (players.length >= 2) {
      socket.emit(ServerEvents.ERROR, {
        code: 'ROOM_FULL',
        message: 'Room already has 2 players',
      });
      return;
    }

    const host = players[0];
    if (!host) {
      socket.emit(ServerEvents.ERROR, {
        code: 'ROOM_INVALID',
        message: 'Room has no host',
      });
      return;
    }

    const [activePrompt] = await db
      .select()
      .from(prompt)
      .where(and(eq(prompt.name, 'modifier-v1'), eq(prompt.isActive, true)))
      .orderBy(sql`${prompt.version} DESC`)
      .limit(1);

    const sessionToken = generateSessionToken();

    const result = await db.transaction(async (tx) => {
      const [joiner] = await tx
        .insert(player)
        .values({
          gameId: gameRow.id,
          displayName: payload.nickname,
          position: 1,
          sessionToken,
        })
        .returning();
      if (!joiner) throw new Error('player insert returned no row');

      await tx
        .update(game)
        .set({
          status: 'playing',
          promptId: activePrompt?.id ?? null,
          currentPlayerId: host.id,
          updatedAt: new Date(),
        })
        .where(eq(game.id, gameRow.id));

      return joiner;
    });

    await this.sessionService.cacheSession(
      sessionToken,
      result.id,
      gameRow.id,
    );

    const [updatedGame] = await db
      .select()
      .from(game)
      .where(eq(game.id, gameRow.id))
      .limit(1);

    const [topicRow] = gameRow.topicId
      ? await db
          .select()
          .from(topic)
          .where(eq(topic.id, gameRow.topicId))
          .limit(1)
      : [undefined];

    if (!topicRow) {
      socket.emit(ServerEvents.ERROR, {
        code: 'TOPIC_MISSING',
        message: 'Game has no topic assigned',
      });
      return;
    }

    socket.data.game = updatedGame ?? gameRow;
    socket.data.player = result;
    const room = `game:${gameRow.id}`;
    await socket.join(room);

    const joined: LobbyJoinedPayload = {
      gameId: gameRow.id,
      playerId: result.id,
      sessionToken,
      opponent: { playerId: host.id, nickname: host.displayName },
    };
    socket.emit(ServerEvents.LOBBY_JOINED, joined);

    const playerJoined: LobbyPlayerJoinedPayload = {
      players: [
        { playerId: host.id, nickname: host.displayName },
        { playerId: result.id, nickname: result.displayName },
      ],
    };
    socket.to(room).emit(ServerEvents.LOBBY_PLAYER_JOINED, playerJoined);

    const started: GameStartedPayload = {
      topic: topicRow.text,
      totalTurns: gameRow.totalTurns,
      firstPlayerId: host.id,
    };
    server.to(room).emit(ServerEvents.GAME_STARTED, started);

    const yourTurn: GameYourTurnPayload = {
      turnNumber: 1,
      remainingTurns: gameRow.totalTurns * 2,
    };
    setTimeout(() => {
      void (async () => {
        for (const sock of await server.in(room).fetchSockets()) {
          if (sock.data?.player?.id === host.id) {
            sock.emit(ServerEvents.GAME_YOUR_TURN, yourTurn);
          }
        }
      })();
    }, 50);

    this.logger.log(
      `lobby:joined roomCode=${code} gameId=${gameRow.id} joiner=${payload.nickname}`,
    );
  }

  private async pickTopic(category?: string) {
    const rows = category
      ? await db
          .select()
          .from(topic)
          .where(
            eq(
              topic.category,
              category as 'relationships' | 'world' | 'hypothetical' | 'personal' | 'creative',
            ),
          )
      : await db.select().from(topic);
    if (rows.length === 0) return null;
    const idx = Math.floor(Math.random() * rows.length);
    return rows[idx];
  }
}
