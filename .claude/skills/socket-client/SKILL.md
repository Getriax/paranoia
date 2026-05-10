---
name: socket-client
description: Drive a real Socket.IO client against the running Paranoia server for end-to-end repro and QA. Use this when you need to exercise the lobby/game/voting flow without opening a browser.
---

Use this skill to script Socket.IO sessions against the Paranoia server. Useful for reproducing bugs, exercising state-machine transitions, and verifying gateway behavior end-to-end.

## Scope
- Target: a running `apps/server` (default `http://localhost:3000`)
- CLI: `node skills/socket-client.mjs` (in the repo root `skills/` directory)
- Underlying lib: `socket.io-client@4.8`

## Required environment
- `WS_URL` (default `http://localhost:3000`)

## Event vocabulary (per plan.md §4)

Client → Server:
- `lobby:create` `{ nickname, settings: { turns, category } }`
- `lobby:join`   `{ roomCode, nickname }`
- `game:message` `{ text }`
- `vote:submit`  `{ votes: [{ messageId, guessedModified }] }`
- `survey:submit` `{ rating, wouldReplay, comment? }`

Server → Client:
- `lobby:created` `{ roomCode, gameId, playerId, sessionToken }`
- `lobby:joined`  `{ gameId, playerId, sessionToken, opponent }`
- `game:started`  `{ topic, totalTurns, firstPlayerId }`
- `game:message_received` `{ messageId, fromPlayerId, text, turnNumber }`
- `game:your_turn` `{ turnNumber, remainingTurns }`
- `game:voting_phase` `{ messages }`
- `game:results` `{ messages, votes, score }`
- `error` `{ code, message }`

## Core commands

### Drive the happy path (two players, full game)
```bash
node skills/socket-client.mjs happy-path \
  --turns 4 \
  --nickname-a Alice --nickname-b Bob
```

### Lobby create only (returns the room code)
```bash
node skills/socket-client.mjs create --nickname Alice --turns 3
```

### Join an existing room as a second player
```bash
node skills/socket-client.mjs join --room ABC123 --nickname Bob
```

### Reconnect with a session token
```bash
node skills/socket-client.mjs reconnect --token "$SESSION_TOKEN"
```

### Try to send out of turn (negative test)
```bash
node skills/socket-client.mjs out-of-turn --token "$TOKEN_A" --text "should fail"
```

### Stress: spam messages beyond the rate limit
```bash
node skills/socket-client.mjs spam --token "$TOKEN" --count 50 --interval 50
```

## Conventions

- **Always run against localhost** unless explicitly given a staging URL
- **Don't run flow scripts against production.** Each script can create games; flag if `WS_URL` points to prod.
- **One subprocess per player.** When driving two players, the CLI spawns two clients that share the room code.
- **Use the JSON output mode** (`--json`) for scripting; default is human-readable.
- **Errors are reported with the server's `error` event payload** so you can verify validation paths.
