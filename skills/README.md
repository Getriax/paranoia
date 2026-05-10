# Paranoia skill CLIs

Small Node scripts used by Claude Code skills (`.claude/skills/*`). Run them directly when iterating on prompts or driving end-to-end flows.

## Setup

```bash
cp skills/.env.example skills/.env
# Edit skills/.env with real values
set -a; source skills/.env; set +a
```

For the socket client:

```bash
pnpm add -D -w socket.io-client
```

## Tools

| Script | Purpose | Skill |
|---|---|---|
| `openrouter.mjs` | Send a single chat completion to OpenRouter, optionally JSON-mode, optionally over a fixture set | `openrouter` |
| `socket-client.mjs` | Drive the Paranoia gateway as one or two clients (lobby/game/voting) | `socket-client` |

For database inspection use `psql "$POSTGRES_URL"` per the `paranoia-db` skill, and `redis-cli -u "$DRAGONFLY_URL"` per the `dragonfly` skill — no wrapper scripts needed.

## Conventions

- Read-only by default. Don't mutate prod state.
- Don't commit real `.env`. Use the `.env.example` as the source of truth for required variables.
- The socket client refuses to connect to URLs that look like production.
