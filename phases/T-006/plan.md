# T-006: Socket.IO Gateway with Auth

## Summary

Add a NestJS Socket.IO gateway with handshake authentication, heartbeat, type-safe Zod-validated event envelopes, room management (`game:{gameId}`), and reconnect logic that preserves room membership using stored `sessionToken`.

## Acceptance criteria (from issue)

1. `@WebSocketGateway` mounted and listening for Socket.IO connections.
2. Handshake auth via `sessionToken` — or accepts new connection for lobby creation (no token yet).
3. Heartbeat ping/pong keeps connections alive.
4. Type-safe envelopes: all event payloads validated server-side with Zod schemas in `packages/shared`.
5. Rooms organized as `game:{gameId}` — players auto-joined on connect.
6. Reconnect logic preserves room membership using stored `sessionToken`.

## Current state

After T-005, `apps/server` has:
- `src/main.ts` — NestJS bootstrap with pino logger, CORS, shutdown hooks, port 3000.
- `src/app.module.ts` — `ConfigModule` + `LoggerModule` + `ServeStaticModule` + `HealthModule`.
- `src/db/schema.ts` — full Drizzle schema including `player` table with `sessionToken` column.
- `src/db/client.ts` — Drizzle + postgres client.
- `src/db/dragonfly.ts` — ioredis client.
- `src/env/env.validation.ts` — Zod-validated config.
- `packages/shared/src/index.ts` — minimal placeholder (just an `AppConfigSchema`).
- No Socket.IO dependencies, no gateway, no shared Zod event schemas.

## Dependencies to install

Add to `apps/server/package.json` **dependencies**:

```
@nestjs/websockets
@nestjs/platform-socket.io
socket.io
```

No new devDependencies needed.

## Target state

### 1. Shared Zod event schemas — `packages/shared/src/index.ts`

Replace the current placeholder with all WebSocket event schemas. Every client→server and server→client event gets a typed Zod schema and inferred TypeScript type.

```ts
import { z } from 'zod';

// ── Auth ──
export const handshakeAuthSchema = z.object({
  sessionToken: z.string().optional(),
});
export type HandshakeAuth = z.infer<typeof handshakeAuthSchema>;

// ── Client → Server ──

export const lobbyCreateSchema = z.object({
  nickname: z.string().min(1).max(30),
  settings: z.object({
    turns: z.number().int().min(2).max(20).default(6),
    category: z.string().optional(),
  }),
});
export type LobbyCreatePayload = z.infer<typeof lobbyCreateSchema>;

export const lobbyJoinSchema = z.object({
  roomCode: z.string().length(6),
  nickname: z.string().min(1).max(30),
});
export type LobbyJoinPayload = z.infer<typeof lobbyJoinSchema>;

export const gameMessageSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type GameMessagePayload = z.infer<typeof gameMessageSchema>;

export const voteSubmitSchema = z.object({
  votes: z.array(z.object({
    messageId: z.string().uuid(),
    guessedModified: z.boolean(),
  })).min(1),
});
export type VoteSubmitPayload = z.infer<typeof voteSubmitSchema>;

export const surveySubmitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  wouldReplay: z.boolean(),
  comment: z.string().max(500).optional(),
});
export type SurveySubmitPayload = z.infer<typeof surveySubmitSchema>;

// ── Server → Client ──

export const lobbyCreatedSchema = z.object({
  roomCode: z.string().length(6),
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  sessionToken: z.string().min(1),
});
export type LobbyCreatedPayload = z.infer<typeof lobbyCreatedSchema>;

export const lobbyJoinedSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  sessionToken: z.string().min(1),
  opponent: z.object({ playerId: z.string().uuid(), nickname: z.string() }).nullable(),
});
export type LobbyJoinedPayload = z.infer<typeof lobbyJoinedSchema>;

export const lobbyPlayerJoinedSchema = z.object({
  players: z.array(z.object({ playerId: z.string().uuid(), nickname: z.string() })),
});
export type LobbyPlayerJoinedPayload = z.infer<typeof lobbyPlayerJoinedSchema>;

export const gameStartedSchema = z.object({
  topic: z.string(),
  totalTurns: z.number().int(),
  firstPlayerId: z.string().uuid(),
});
export type GameStartedPayload = z.infer<typeof gameStartedSchema>;

export const gameMessageReceivedSchema = z.object({
  messageId: z.string().uuid(),
  fromPlayerId: z.string().uuid(),
  text: z.string(),
  turnNumber: z.number().int(),
});
export type GameMessageReceivedPayload = z.infer<typeof gameMessageReceivedSchema>;

export const gameYourTurnSchema = z.object({
  turnNumber: z.number().int(),
  remainingTurns: z.number().int(),
});
export type GameYourTurnPayload = z.infer<typeof gameYourTurnSchema>;

export const gameVotingPhaseSchema = z.object({
  messages: z.array(z.object({
    id: z.string().uuid(),
    text: z.string(),
    fromPlayerId: z.string().uuid(),
    turnNumber: z.number().int(),
  })),
});
export type GameVotingPhasePayload = z.infer<typeof gameVotingPhaseSchema>;

export const gameOpponentVotingSchema = z.object({
  submitted: z.boolean(),
});
export type GameOpponentVotingPayload = z.infer<typeof gameOpponentVotingSchema>;

export const gameResultsSchema = z.object({
  messages: z.array(z.any()),
  votes: z.array(z.any()),
  score: z.number(),
  opponentSurveyPending: z.boolean(),
});
export type GameResultsPayload = z.infer<typeof gameResultsSchema>;

export const surveySubmittedSchema = z.object({
  playerId: z.string().uuid(),
});
export type SurveySubmittedPayload = z.infer<typeof surveySubmittedSchema>;

export const gameOpponentDisconnectedSchema = z.object({
  reconnectDeadline: z.string(), // ISO timestamp
});
export type GameOpponentDisconnectedPayload = z.infer<typeof gameOpponentDisconnectedSchema>;

export const gameOpponentReconnectedSchema = z.object({});
export type GameOpponentReconnectedPayload = z.infer<typeof gameOpponentReconnectedSchema>;

export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorPayload = z.infer<typeof errorSchema>;

// Event name constants for type safety
export const ClientEvents = {
  LOBBY_CREATE: 'lobby:create',
  LOBBY_JOIN: 'lobby:join',
  GAME_MESSAGE: 'game:message',
  VOTE_SUBMIT: 'vote:submit',
  SURVEY_SUBMIT: 'survey:submit',
} as const;

export const ServerEvents = {
  LOBBY_CREATED: 'lobby:created',
  LOBBY_JOINED: 'lobby:joined',
  LOBBY_PLAYER_JOINED: 'lobby:player_joined',
  GAME_STARTED: 'game:started',
  GAME_MESSAGE_RECEIVED: 'game:message_received',
  GAME_YOUR_TURN: 'game:your_turn',
  GAME_VOTING_PHASE: 'game:voting_phase',
  GAME_OPPONENT_VOTING: 'game:opponent_voting',
  GAME_RESULTS: 'game:results',
  SURVEY_SUBMITTED: 'survey:submitted',
  GAME_OPPONENT_DISCONNECTED: 'game:opponent_disconnected',
  GAME_OPPONENT_RECONNECTED: 'game:opponent_reconnected',
  ERROR: 'error',
} as const;
```

### 2. Auth guard for WebSocket — `apps/server/src/ws/ws-auth.guard.ts`

A NestJS guard that runs on every gateway event. Extracts `socket.data.player` (set during `handleConnection`) and rejects if not present.

```ts
import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { WsException } from '@nestjs/websockets';

@Injectable()
export class WsAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const client = context.switchToWs().getClient();
    if (!client.data?.player) {
      throw new WsException('Unauthorized — no valid session');
    }
    return true;
  }
}
```

Note: lobby:create and lobby:join do NOT require auth (new players have no token). The guard is applied per-handler, NOT globally.

### 3. Session service — `apps/server/src/ws/session.service.ts`

Resolves a `sessionToken` to a player + game by querying the `player` table. Caches lookups in Dragonfly with a 60s TTL.

```ts
@Injectable()
export class SessionService {
  constructor(
    @Inject(DRIZZLE) private db: DrizzleInstance,
    private redis: Redis, // Dragonfly
  ) {}

  async resolveSession(sessionToken: string): Promise<{ player: PlayerRow; game: GameRow } | null> {
    // 1. Check Dragonfly cache: session:{token} → JSON { playerId, gameId }
    // 2. If miss, query player table WHERE sessionToken = $1, join game
    // 3. If found, cache result in Dragonfly with 60s TTL
    // 4. Return null if not found
  }

  async cacheSession(sessionToken: string, playerId: string, gameId: string): Promise<void> {
    // Store session mapping in Dragonfly
  }
}
```

### 4. Game gateway — `apps/server/src/ws/game.gateway.ts`

The main `@WebSocketGateway` class:

```ts
@WebSocketGateway({
  cors: { origin: '*' },  // dev; production restricts via reverse proxy
  pingInterval: 25000,     // heartbeat: server sends ping every 25s
  pingTimeout: 20000,      // disconnect if no pong within 20s
  connectTimeout: 10000,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
```

**Connection handler (`handleConnection`):**
1. Read `socket.handshake.auth.sessionToken` (may be undefined for brand-new connections).
2. If `sessionToken` is present → call `SessionService.resolveSession()`.
3. If resolved → store player+game in `socket.data`, join room `game:{gameId}`, emit `game:opponent_reconnected` to room (if game is `playing`).
4. If NOT resolved (invalid/expired token) → emit `error` with code `INVALID_SESSION` and disconnect.
5. If no `sessionToken` (new connection for lobby creation) → leave socket unauthenticated. `socket.data.player` remains `undefined`. Only `lobby:create` and `lobby:join` are allowed.

**Disconnect handler (`handleDisconnect`):**
1. If `socket.data.player` exists and game is `playing` → emit `game:opponent_disconnected` to room `game:{gameId}` with `reconnectDeadline` (now + 30s ISO timestamp).
2. Set a Dragonfly key `disconnect:{gameId}:{playerId}` with 30s TTL. If the player reconnects within 30s, the key is deleted. If it expires, the game transitions to `abandoned` (full abandonment logic is out of scope for T-006 — just emit the event and set the key).

**Event handlers (stub implementations — return acknowledged event, log, no business logic):**

Each handler validates its payload with the shared Zod schema, logs the event, and emits an acknowledgment. Full game logic (DB writes, modifier calls, etc.) belongs to later tickets (T-007+). T-006 focuses on the gateway shell, auth, and room mechanics.

- `@SubscribeMessage('lobby:create')` — validate with `lobbyCreateSchema`. No auth guard needed. Create player row with generated `sessionToken`, emit `lobby:created` back with token.
- `@SubscribeMessage('lobby:join')` — validate with `lobbyJoinSchema`. No auth guard needed. Create player row, emit `lobby:joined` back. Join `game:{gameId}` room. Emit `lobby:player_joined` to room.
- `@SubscribeMessage('game:message')` — apply `WsAuthGuard`. Validate with `gameMessageSchema`. Log and acknowledge. (Actual modifier pipeline is T-007+.)
- `@SubscribeMessage('vote:submit')` — apply `WsAuthGuard`. Validate with `voteSubmitSchema`. Log and acknowledge.
- `@SubscribeMessage('survey:submit')` — apply `WsAuthGuard`. Validate with `surveySubmitSchema`. Log and acknowledge.

### 5. WebSocket module — `apps/server/src/ws/ws.module.ts`

```ts
import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { SessionService } from './session.service.js';
import { DbModule } from '../db/db.module.js'; // or provide DRIZZLE directly

@Module({
  providers: [GameGateway, SessionService],
  exports: [SessionService],
})
export class WsModule {}
```

The module imports the DB provider (however it's exposed — currently `src/db/client.ts` exports a `db` instance; the dev should wire injection appropriately, possibly creating a small `DbModule` if one doesn't exist).

### 6. Register WsModule in `app.module.ts`

Add `WsModule` to the `imports` array in `apps/server/src/app.module.ts`.

### 7. Update `packages/shared` — rebuild

After updating `packages/shared/src/index.ts`, run `pnpm --filter @openclaw/shared build` to ensure the shared package compiles and is importable by the server.

## Files to create

| File | Purpose |
|---|---|
| `packages/shared/src/index.ts` | Replace with full Zod event schemas + type exports + event name constants |
| `apps/server/src/ws/ws.module.ts` | NestJS module registering gateway + session service |
| `apps/server/src/ws/game.gateway.ts` | `@WebSocketGateway` with connection/disconnect/auth/event handlers |
| `apps/server/src/ws/session.service.ts` | Resolves sessionToken → player+game, with Dragonfly cache |
| `apps/server/src/ws/ws-auth.guard.ts` | NestJS guard that checks `socket.data.player` |

## Files to modify

| File | Change |
|---|---|
| `apps/server/package.json` | Add `@nestjs/websockets`, `@nestjs/platform-socket.io`, `socket.io` dependencies |
| `apps/server/src/app.module.ts` | Add `WsModule` to imports |
| `packages/shared/src/index.ts` | Full rewrite with event schemas (technically "modify" since file exists) |

## Files to delete

None.

## Design decisions

1. **Auth guard per-handler, not global.** `lobby:create` and `lobby:join` must work without a session token. A global guard would block them. Instead, apply `@UseGuards(WsAuthGuard)` only on handlers that require auth.

2. **Heartbeat via Socket.IO built-in ping/pong.** The `pingInterval`/`pingTimeout` config on the gateway handles this automatically. No custom heartbeat events needed.

3. **Reconnect logic.** When a client reconnects with a valid `sessionToken`, the gateway re-joins them to `game:{gameId}`. The client does NOT need to re-emit any event — the connection handler does this automatically.

4. **Stub handlers for future tickets.** `game:message`, `vote:submit`, `survey:submit` handlers validate input and log, but don't implement business logic. Those are T-007+ scope. The gateway shell (auth, rooms, schemas, reconnect) is the T-006 deliverable.

5. **Zod schemas in shared package.** All event schemas live in `packages/shared` so the future React frontend can import the same types. The server gateway validates every incoming payload against the appropriate schema before processing.

6. **Dragonfly for session caching + disconnect tracking.** The `SessionService` caches token→player lookups to avoid DB hits on every reconnect. The disconnect handler sets a TTL'd key for the 30s reconnect window.

## Out of scope (later tickets)

- `lobby:create` creating actual game rows in Postgres (just creates a session token and returns a stub response for now)
- `lobby:join` finding games by room code (needs DB query wiring)
- `game:message` modifier pipeline (T-007+)
- `vote:submit` vote recording (later)
- `survey:submit` survey recording (later)
- Game state machine transitions (later)
- Rate limiting on events (later)
- Frontend `useGameSocket` hook (frontend ticket)
