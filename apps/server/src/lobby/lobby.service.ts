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
  type LobbyPlayerReadyPayload,
  type GameStartedPayload,
} from '@openclaw/shared';

const DEFAULT_MODEL =
  process.env.MODIFIER_DEFAULT_MODEL ?? 'deepseek/deepseek-v4-flash';

@Injectable()
export class LobbyService {
  private readonly logger = new Logger(LobbyService.name);

  // Ephemeral ready tracking per game. Wiped when game starts or server restarts.
  private readonly readyByGame = new Map<string, Set<string>>();

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

    const sessionToken = generateSessionToken();

    const joiner = await db.transaction(async (tx) => {
      const [j] = await tx
        .insert(player)
        .values({
          gameId: gameRow.id,
          displayName: payload.nickname,
          position: 1,
          sessionToken,
        })
        .returning();
      if (!j) throw new Error('player insert returned no row');
      return j;
    });

    await this.sessionService.cacheSession(sessionToken, joiner.id, gameRow.id);

    socket.data.game = gameRow;
    socket.data.player = joiner;
    const room = `game:${gameRow.id}`;
    await socket.join(room);

    const readySet = this.readyByGame.get(gameRow.id) ?? new Set<string>();

    const joined: LobbyJoinedPayload = {
      gameId: gameRow.id,
      playerId: joiner.id,
      sessionToken,
      roomCode: code,
      opponent: { playerId: host.id, nickname: host.displayName },
    };
    socket.emit(ServerEvents.LOBBY_JOINED, joined);

    const playerJoined: LobbyPlayerJoinedPayload = {
      players: [
        {
          playerId: host.id,
          nickname: host.displayName,
          ready: readySet.has(host.id),
        },
        {
          playerId: joiner.id,
          nickname: joiner.displayName,
          ready: readySet.has(joiner.id),
        },
      ],
    };
    server.to(room).emit(ServerEvents.LOBBY_PLAYER_JOINED, playerJoined);

    this.logger.log(
      `lobby:joined roomCode=${code} gameId=${gameRow.id} joiner=${payload.nickname}`,
    );
  }

  async markReady(server: Server, socket: Socket): Promise<void> {
    const playerData = socket.data?.player as { id: string } | undefined;
    const gameData = socket.data?.game as { id: string; status: string } | undefined;
    if (!playerData || !gameData) {
      socket.emit(ServerEvents.ERROR, {
        code: 'NOT_IN_GAME',
        message: 'No game context — please rejoin',
      });
      return;
    }
    if (gameData.status !== 'lobby') {
      // already started / finished — ignore
      return;
    }

    let set = this.readyByGame.get(gameData.id);
    if (!set) {
      set = new Set<string>();
      this.readyByGame.set(gameData.id, set);
    }

    if (set.has(playerData.id)) return; // idempotent
    set.add(playerData.id);

    const room = `game:${gameData.id}`;
    const readyPayload: LobbyPlayerReadyPayload = {
      playerId: playerData.id,
      ready: true,
    };
    server.to(room).emit(ServerEvents.LOBBY_PLAYER_READY, readyPayload);

    const players = await db
      .select()
      .from(player)
      .where(eq(player.gameId, gameData.id));

    if (players.length < 2) return;
    const allReady = players.every((p) => set!.has(p.id));
    if (!allReady) return;

    await this.startGame(server, gameData.id, players);
  }

  private async startGame(
    server: Server,
    gameId: string,
    players: { id: string }[],
  ): Promise<void> {
    const [gameRow] = await db
      .select()
      .from(game)
      .where(eq(game.id, gameId))
      .limit(1);
    if (!gameRow) return;
    if (gameRow.status !== 'lobby') return; // already started by a concurrent ready

    const [activePrompt] = await db
      .select()
      .from(prompt)
      .where(and(eq(prompt.name, 'modifier-v1'), eq(prompt.isActive, true)))
      .orderBy(sql`${prompt.version} DESC`)
      .limit(1);

    const firstPlayerId = players[Math.floor(Math.random() * players.length)]!.id;

    await db
      .update(game)
      .set({
        status: 'playing',
        promptId: activePrompt?.id ?? null,
        currentPlayerId: firstPlayerId,
        updatedAt: new Date(),
      })
      .where(eq(game.id, gameId));

    // Refresh socket cached game.status for both players so subsequent emits
    // (and the WS auth guard's game-status checks) see 'playing'.
    const room = `game:${gameId}`;
    for (const sock of await server.in(room).fetchSockets()) {
      if (sock.data?.game?.id === gameId) {
        sock.data.game = { ...sock.data.game, status: 'playing', currentPlayerId: firstPlayerId };
      }
    }

    const [topicRow] = gameRow.topicId
      ? await db.select().from(topic).where(eq(topic.id, gameRow.topicId)).limit(1)
      : [undefined];
    if (!topicRow) {
      this.logger.error(`startGame: game ${gameId} has no topic`);
      return;
    }

    const started: GameStartedPayload = {
      topic: topicRow.text,
      totalTurns: gameRow.totalTurns,
      firstPlayerId,
    };
    server.to(room).emit(ServerEvents.GAME_STARTED, started);

    this.readyByGame.delete(gameId);

    this.logger.log(
      `game:started gameId=${gameId} firstPlayerId=${firstPlayerId}`,
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
