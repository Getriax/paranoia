# Paranoia — Game System Plan (v2)

**Working name:** Paranoia
**Purpose:** Full technical specification to be consumed by the OpenClaw pipeline (architect → dev → deployer → qa).
**Plan location:** `projects/paranoia/plan.md` in Getriax/openclaw-harness

> **Changes from v1:** Stack switched to NestJS + Socket.IO. React app built and served from the same Docker image. OpenRouter as LLM provider (model-agnostic). Prompts stored in DB and versioned. Engagement scoring (survey + optional LLM analysis) added.

---

## 1. Product overview

### Concept
A real-time, mobile-first multiplayer conversation game for 2 players. After joining the same room, players receive a shared starting topic and converse turn-by-turn. Between every outgoing message and its delivery, an LLM "manager" analyzes the full transcript and decides whether to modify the message (and how). After N turns, players enter a voting phase and mark messages they suspect were AI-modified. After voting, originals and scores are revealed.

### MVP mode: Paranoia (symmetric)
Neither sender nor receiver gets any indicator that a message was modified. The sender sees what they typed. The receiver sees whatever the LLM decided to deliver. After voting, both see the diffs.

### LLM modifier objective
Composite score:
- **60% deception** — fraction of modifications players failed to detect
- **40% engagement** — depth and quality of the conversation (signals: survey ratings, optional LLM-based analysis, conversation length, thread continuity)

Engagement is measured from day one via an optional post-game survey. LLM-based engagement analysis is an optional pipeline that can run async after each game.

---

## 2. Tech stack & architecture

### Stack
- **Backend:** NestJS (Node.js 20, TypeScript strict)
- **Real-time:** Socket.IO via `@nestjs/websockets` + `@nestjs/platform-socket.io`
- **Frontend:** React 18 + Vite + TypeScript + Tailwind, served as static assets by NestJS (`@nestjs/serve-static`)
- **ORM:** Drizzle (lightweight, type-safe, migration-friendly)
- **Database:** Postgres (Coolify-managed)
- **In-memory:** Dragonfly (Coolify-managed) — room state, presence, distributed locks, rate limiting
- **LLM provider:** OpenRouter (one API, swappable models — Claude, GLM, Llama, etc.)
- **Logging:** nestjs-pino
- **Validation:** Zod (DTOs and event payloads)
- **Packaging:** Single Docker image (multi-stage build), one container, one port
- **Monorepo:** pnpm workspaces — `apps/server`, `apps/web`, `packages/shared`

### Components
1. **NestJS server** — REST endpoints (admin, health), Socket.IO gateway (game protocol), static file serving (React build), background workers (engagement analysis).
2. **Modifier module** — encapsulates prompt loading from DB, OpenRouter call, response parsing, fallback handling.
3. **Engagement module** — survey ingestion + (optional) async LLM analysis worker.
4. **Postgres** — durable storage: games, players, messages, votes, prompts, engagement.
5. **Dragonfly** — room state, presence, locks, rate limits, ephemeral session data.

### Single Docker image flow
Multi-stage Dockerfile:
1. Build React (`apps/web`) → static `dist/`
2. Build NestJS (`apps/server`) → compiled `dist/`
3. Production image: copy NestJS build + React static + install prod deps. NestJS serves React from `/public` via `ServeStaticModule`. WebSocket on the same port.

### Per-turn data flow
1. Player A sends a message via Socket.IO → NestJS gateway
2. Server validates turn ownership and persists original to Postgres (not yet visible to B)
3. Server fetches active modifier prompt from DB + full transcript + game context
4. Server calls OpenRouter via the modifier module
5. Modifier returns structured JSON: `{ modify, strategy, modified_message?, reasoning, confidence }`
6. Server persists decision to `messages.modifier_*` columns
7. Server emits final version (`delivered_text`) to player B via Socket.IO room
8. Turn flips to B; emit `game.your_turn`
9. After N turns each → state transitions to `voting`

---

## 3. Data model (Postgres / Drizzle)

```sql
games (
  id                UUID PK,
  room_code         VARCHAR(6) UNIQUE,
  status            ENUM('lobby','playing','voting','finished','abandoned'),
  topic_id          UUID FK,
  total_turns       INT,              -- per player
  current_turn      INT,
  current_player_id UUID,
  game_mode         VARCHAR(20) DEFAULT 'paranoia',
  modifier_prompt_id UUID FK REFERENCES prompts(id),
  modifier_model    VARCHAR(100),     -- OpenRouter model id, default "deepseek/deepseek-v4-flash"
  created_at        TIMESTAMPTZ,
  started_at        TIMESTAMPTZ,
  finished_at       TIMESTAMPTZ
)

players (
  id            UUID PK,
  game_id       UUID FK,
  nickname      VARCHAR(30),
  position      INT,              -- 1 or 2
  session_token VARCHAR(64),      -- for reconnect
  joined_at     TIMESTAMPTZ,
  last_seen_at  TIMESTAMPTZ
)

messages (
  id                   UUID PK,
  game_id              UUID FK,
  player_id            UUID FK,       -- author (sender)
  turn_number          INT,
  original_text        TEXT,
  delivered_text       TEXT,          -- what arrived at the receiver
  was_modified         BOOLEAN,
  modifier_strategy    VARCHAR(20),   -- stylistic|sense_shift|injection|rewrite|null
  modifier_reasoning   TEXT,          -- not shown to players, training signal
  modifier_confidence  FLOAT,
  modifier_model       VARCHAR(100),  -- snapshot per message
  modifier_prompt_id   UUID,         -- snapshot per message (in case prompt rotates)
  modifier_latency_ms  INT,
  modifier_input_tokens  INT,
  modifier_output_tokens INT,
  sent_at              TIMESTAMPTZ
)

votes (
  id                UUID PK,
  game_id           UUID FK,
  voter_id          UUID FK,
  message_id        UUID FK,
  guessed_modified  BOOLEAN,
  voted_at          TIMESTAMPTZ,
  UNIQUE(voter_id, message_id)
)

topics (
  id          UUID PK,
  category    VARCHAR(50),
  text        TEXT,
  difficulty  VARCHAR(10),    -- easy|medium|hard
  active      BOOLEAN
)

prompts (
  id              UUID PK,
  name            VARCHAR(100),   -- "modifier" | "engagement_analysis" | "game_summary"
  type            VARCHAR(50),
  version         INT,
  system_prompt   TEXT,
  user_template   TEXT,          -- with {placeholders}
  default_model   VARCHAR(100),  -- OpenRouter model id
  default_params  JSONB,         -- { temperature, max_tokens, top_p, response_format }
  active          BOOLEAN,
  notes           TEXT,
  created_at      TIMESTAMPTZ,
  UNIQUE(name, version)
)

engagement_surveys (  -- player-submitted, fast feedback
  id            UUID PK,
  game_id       UUID FK,
  player_id     UUID FK,
  rating        INT,            -- 1..5 "how interesting was this conversation"
  would_replay  BOOLEAN,
  comment       TEXT,
  submitted_at  TIMESTAMPTZ,
  UNIQUE(game_id, player_id)
)

engagement_analyses (  -- LLM-generated, async
  id           UUID PK,
  game_id      UUID FK,
  score        FLOAT,           -- 0..1
  dimensions   JSONB,           -- { depth, callbacks, novelty, coherence }
  reasoning    TEXT,
  model        VARCHAR(100),
  prompt_id    UUID FK REFERENCES prompts(id),
  computed_at  TIMESTAMPTZ
)
```

**Notes:**
- Topics stay separate from `prompts` — they have different shape (category, difficulty) and serve a different purpose (conversation starters vs. LLM instructions).
- `prompts` table allows A/B testing prompt versions and correlating outcomes with prompt changes.
- The `modifier_prompt_id` snapshot in `games` and `messages` makes per-game and per-message attribution exact.

---

## 4. WebSocket contracts (Socket.IO)

Auth handshake: client passes `sessionToken` in `socket.handshake.auth`. Server resolves to player + game and joins the corresponding `game:{gameId}` room.

### Client → Server events

| Event | Payload | Notes |
|---|---|---|
| `lobby:create` | `{ nickname, settings: { turns, category } }` | Creates a room |
| `lobby:join` | `{ roomCode, nickname }` | Joins existing room |
| `game:message` | `{ text }` | Sends a message (server validates turn ownership) |
| `vote:submit` | `{ votes: [{ messageId, guessedModified }] }` | Submits all votes |
| `survey:submit` | `{ rating, wouldReplay, comment? }` | Optional post-game engagement |
| `session:resume` | (uses handshake token) | Implicit on reconnect |

### Server → Client events

| Event | Payload |
|---|---|
| `lobby:created` | `{ roomCode, gameId, playerId, sessionToken }` |
| `lobby:joined` | `{ gameId, playerId, sessionToken, opponent }` |
| `lobby:player_joined` | `{ players }` |
| `game:started` | `{ topic, totalTurns, firstPlayerId }` |
| `game:message_received` | `{ messageId, fromPlayerId, text, turnNumber }` |
| `game:your_turn` | `{ turnNumber, remainingTurns }` |
| `game:voting_phase` | `{ messages: [{ id, text, fromPlayerId, turnNumber }] }` |
| `game:opponent_voting` | `{ submitted }` |
| `game:results` | `{ messages: [...with originals], votes, score, opponentSurveyPending }` |
| `survey:submitted` | `{ playerId }` |
| `game:opponent_disconnected` | `{ reconnectDeadline }` |
| `game:opponent_reconnected` | `{}` |
| `error` | `{ code, message }` |

All payloads validated server-side via Zod DTOs. Shared types in `packages/shared`.

---

## 5. Modifier contract & OpenRouter integration

### OpenRouter
One unified API across providers. Model id format: `provider/model-name` (default: `deepseek/deepseek-v4-flash`; alternates: `anthropic/claude-haiku-4.5`, `openai/gpt-4o-mini`, `meta-llama/llama-3.1-70b-instruct`, `z-ai/glm-4-9b`). Supports OpenAI-compatible chat completions endpoint. Allows trivial A/B between models per game by varying `games.modifier_model`. Cost and latency vary widely; the default targets low cost + low latency.

### Modifier prompt loading
On game start, server fetches the currently active `modifier` prompt from `prompts` table (highest version with `active=true`). Snapshots `prompt_id` and `model` into the `games` row. Subsequent messages in that game use the same snapshot, even if a newer prompt is activated mid-game.

### Modifier input
**System prompt** (loaded from DB): rules, objective function, strategic heuristics, output schema.

**User message** (templated):
```
Topic: {topic}
Turn {n} of {total}
Modifications so far: {count}/{n-1}
Transcript:
{playerA}: {msg1}
{playerB}: {msg2}
...
Current message from {currentPlayer}: {message}
Decide.
```

### Modifier output (strict JSON, validated with Zod)
```json
{
  "modify": true,
  "strategy": "sense_shift",
  "modified_message": "...",
  "reasoning": "Player wrote a generic question; subtle shift to make it more pointed without losing voice.",
  "confidence_will_fool": 0.7
}
```

### Strategic heuristics (encoded in the prompt)
- **Early turns** → low context for receiver, easier deception, low impact
- **Mid turns** → sweet spot, medium recall, high impact
- **Late turns** → players will scan their memory, risky but impactful
- **Generic/flat message** → modify more aggressively, push depth
- **Already sharp/personal message** → more often leave it
- **Cap modification rate** around ~40% of messages (avoid predictability)

### Fallback policy
On any failure (timeout >8s, invalid JSON, network error, OpenRouter 5xx) → return original message unmodified, log warn with full context, set `was_modified=false`. Game must continue. Latency budget for the user-perceived "thinking" indicator: 5s soft cap, then proceed regardless.

### Cost guardrails
- Truncate transcript context if > N tokens (config).
- Keep first message, last K messages, summarize middle.

---

## 6. Engagement scoring

### Survey (synchronous, player-submitted)
After `game:results`, prompt each player with optional survey:
- Rating 1–5
- Would replay? (boolean)
- Free text comment (optional)

Persisted to `engagement_surveys`.

### Engagement analysis (async, LLM-generated)
After game finishes, a background worker fetches the `engagement_analysis` prompt from DB, sends the full transcript + survey responses to OpenRouter, and writes a structured result to `engagement_analyses`:

```json
{
  "score": 0.74,
  "dimensions": {
    "depth": 0.8,
    "callbacks": 0.6,
    "novelty": 0.85,
    "coherence": 0.7
  },
  "reasoning": "Conversation explored the topic from three angles, players built on each other's points, ..."
}
```

### Composite reward formula
```
reward = 0.6 * deception_rate + 0.4 * engagement_score
```

---

## 7. Deployment architecture

### Tags for tickets: `backend|frontend|infra|ai|qa|content`

### Infra layout
- `apps/server` + `apps/web` + `packages/shared` in monorepo
- `pnpm dev` starts both with hot reload
- `pnpm db:migrate` runs migrations
- `pnpm db:seed` seeds topics + modifier prompt

### Environment variables
- `DATABASE_URL`, `DRAGONFLY_URL`, `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL`, `ADMIN_TOKEN`, `NODE_ENV`

### Domain
- `paranoia.krulestwo.com` via Traefik + Cloudflare Zero Trust Tunnel (WebSocket-capable)

### Seeds
- `seeds/topics.json` with 50 starter topics

### Health
- `/health` endpoint checking Postgres + Dragonfly + OpenRouter reachability
- nestjs-pino for structured logging
- `@nestjs/config` with Zod env validation

### Dragonfly patterns
- NestJS module wrapping ioredis/Dragonfly client
- Room state: `room:{code}` → `{gameId, players, status, currentPlayerId}`
- Turn lock: `lock:turn:{gameId}` → mutex
- Session → player resolution via `sessionToken` stored in `socket.handshake.auth`
- `game:{gameId}` Socket.IO room for broadcasting

### Game lifecycle
- lobby → playing → voting → finished (+ abandoned)
- State machine validates transitions

### Modifier pipeline
- `OpenRouterModule` wrapping API calls
- `PromptsModule` with caching for active prompt
- `ModifierService.modify({ transcript, message, gameContext, promptId, model })` returns `ModifierDecision`
- Errors: `LLMTimeout | LLMInvalidResponse | LLMNetworkError | LLMRateLimited`
- Persists all modifier metadata to `messages.modifier_*` fields

### Lobby + game flow
- `lobby:create` / `lobby:join` → create/join room, select topic, snapshot prompt+model
- `game:started` when 2 players present
- Turn loop with modifier call per message
- End-game transition → voting phase → results

### Engagement pipeline
- `survey:submit` → `engagement_surveys`
- `survey:submitted` event to opponent
- Background worker: `engagement_analysis` prompt → `engagement_analyses`
- `ENGAGEMENT_ANALYSIS_ENABLED` env flag

### Frontend architecture
- React 18 + Vite + TS + Tailwind, build to `apps/web/dist`
- Components: Button, Input, Textarea (autosize), MessageBubble, Modal, Toast, Spinner, StarRating
- `useGameSocket(sessionToken?)` hook wrapping socket.io-client
- Type-safe emit/on via `packages/shared`
- Connection states: connecting | connected | reconnecting | error
- `sessionToken` persisted in localStorage
- Reconnect logic: `sessionToken` → resume or `abandoned`
- Mobile-first, touch targets ≥ 44px, dark theme default

### Admin
- `GET /admin/export?from=&to=&include=...` protected by bearer token (`ADMIN_TOKEN`)
- Returns JSONL with games + messages + votes + surveys + analyses joined per game

---

## 8. QA / test scenarios

### Critical paths (E2E)
1. Happy path — lobby to results, both votes counted, optional survey submitted
2. Disconnect mid-game and reconnect within 30s
3. Disconnect without reconnect → `abandoned`, opponent gets friendly screen
4. Modifier timeout → message passes through as original, warn logged
5. Modifier returns invalid JSON → message passes through as original
6. OpenRouter rate-limited → retry then fallback
7. Joining a full room → error
8. Joining with non-existent room code → error
9. Message spam → rate limit kicks in, 429
10. Sending out of turn → backend rejects, frontend shouldn't allow
11. Engagement survey: submit, skip, both partial

### Modifier fixtures
- 20 (transcript, message) pairs in unit-test fixtures with valid LLM JSON outputs
- 5 edge cases: very short message, very long message, single word, emoji-only, link-only
- 5 malformed LLM outputs (missing fields, wrong types, truncated JSON)

---

## 9. Deployment notes

- All-in-one container deployed via Coolify on TrueNAS
- Postgres + Dragonfly: Coolify-managed resources, dedicated per-app
- App service: single container exposing port 3000 (NestJS serves React + Socket.IO)
- Domain: `paranoia.krulestwo.com` via Traefik + Cloudflare Zero Trust Tunnel (WebSocket-capable, already configured)
- LLM access: env vars `OPENROUTER_API_KEY`, `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`)
- Postgres backups: nightly TrueNAS snapshots at the volume level
- Logs: stdout → Coolify aggregation
- Resource hints: 512MB RAM ceiling acceptable for MVP; horizontal scaling deferred (state in Dragonfly already supports it when needed)

---

## 10. Roadmap post-MVP

In rough priority order:
1. **Conspirator mode** — sender sees only the modified version of their own message (new `game_mode`)
2. **Tribunal mode (3+ players)** — observers join, all vote at end
3. **Custom topics** — players type their own opener (with moderation)
4. **Offline eval harness** — self-play modifier vs detector model, automated detection-rate scoring, prompt regression suite
5. **Modifier fine-tune** — after 5k+ modified messages with votes, SFT on a small model (Qwen 2.5 7B / GLM 4 9B), then DPO with reward model from votes + engagement
6. **Per-prompt A/B testing** — assign games to active prompt versions with even distribution, compare composite reward
7. **Anonymous leaderboards** — per nickname accuracy stats
8. **Shareable replay links** — public read-only game viewer
9. **AI game summary** — LLM-generated "what came out of this conversation" as a shareable artifact
