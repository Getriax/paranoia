---
name: dragonfly
description: Inspect Paranoia's Dragonfly (Redis-compatible) state via redis-cli. Use to read room state, presence, locks, and rate-limit counters.
---

Use this skill to read ephemeral state from Dragonfly. Dragonfly is Redis-compatible; the project uses `ioredis` against `$DRAGONFLY_URL`. For ad-hoc inspection, use `redis-cli`.

## Scope
- Service: Dragonfly (Redis-protocol)
- Connection: `$DRAGONFLY_URL` (e.g., `redis://localhost:6379`)
- CLI: `redis-cli -u "$DRAGONFLY_URL"` for reads
- Application client: `apps/server/src/db/dragonfly.ts` (ioredis)

## Required environment
- `DRAGONFLY_URL` (required) — typically loaded from `apps/server/.env`

## Key namespaces (canonical)

| Namespace | Purpose | TTL |
|---|---|---|
| `room:{roomCode}` | room state JSON: `{ gameId, players, status, currentPlayerId }` | game-lifetime |
| `lock:turn:{gameId}` | mutex during turn flip / message handling | seconds |
| `presence:{playerId}` | last_seen heartbeat | 60s rolling |
| `rate:msg:{playerId}` | per-player message rate counter | 10s window |
| `rate:lobby:{ip}` | per-IP lobby create rate counter | 60s window |
| `session:{token}` | session-token → playerId lookup (when used) | game-lifetime |

If you find keys outside these namespaces, treat them as suspicious and surface to the developer.

## Common recipes

### Inspect a room
```bash
redis-cli -u "$DRAGONFLY_URL" GET "room:ABC123" | jq .
```

### List all active rooms
```bash
redis-cli -u "$DRAGONFLY_URL" --scan --pattern 'room:*'
```

### Check turn lock
```bash
redis-cli -u "$DRAGONFLY_URL" GET "lock:turn:<gameId>"
redis-cli -u "$DRAGONFLY_URL" TTL  "lock:turn:<gameId>"
```

### Check presence
```bash
redis-cli -u "$DRAGONFLY_URL" GET "presence:<playerId>"
redis-cli -u "$DRAGONFLY_URL" TTL "presence:<playerId>"
```

### Count messages emitted in current rate window
```bash
redis-cli -u "$DRAGONFLY_URL" GET "rate:msg:<playerId>"
```

### List all keys (development only — never in prod)
```bash
redis-cli -u "$DRAGONFLY_URL" --scan
```

## Conventions

- **Read-only by default.** Don't `SET` or `DEL` against prod ad-hoc.
- **No FLUSHALL / FLUSHDB.** Ever.
- **Always set TTLs on ephemeral keys.** A key without TTL is a bug — flag to the developer.
- **JSON values:** stored as strings; pipe through `jq` for readability.
- **Locks:** acquire with `SET key val NX PX <ms>`, release with a Lua script that checks the value before deleting (don't trust client to release a stale lock).
