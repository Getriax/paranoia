# QA — Paranoia server

## Running

```
pnpm --filter @openclaw/server test          # unit + parse specs
RUN_E2E=1 pnpm --filter @openclaw/server test # plus e2e (server must be running on :3000)
```

The e2e spec is skip-gated by `RUN_E2E=1`; CI pipelines without a live server skip it automatically.

## What the suite covers

| File | Scope |
| --- | --- |
| `test/unit/room-code.spec.ts` | Code length (6), unambiguous alphabet, low collision rate, session token format |
| `test/unit/state-machine.spec.ts` | All allowed transitions in the lobby → playing → voting → finished pipeline; abandonment from any active state; terminal nodes; no self-loops |
| `test/unit/voting-score.spec.ts` | `0.6 * deception_rate + 0.4 * 0.5` formula at boundaries (0/1) and intermediate fractions; ignore non-opponent and own-message votes |
| `test/modifier/parse.spec.ts` | Loads 20 fixtures; asserts normal+edge parse and malformed reject. Demonstrates the `modify=true` + missing `modified_message` passthrough behaviour |
| `test/e2e/happy-path.spec.ts` | Two clients complete a full 4-turn game and receive `GAME_RESULTS` |

## Modifier fixtures

`test/modifier/fixtures/` contains 20 JSON examples grouped:

- `normal-*` (10) — strategy variants and pass-through cases
- `edge-*` (5) — `modify:true` without text, empty string, `strategy: null`, extra keys, confidence boundary
- `malformed-*` (5) — invalid strategy, wrong types, out-of-range confidence, missing required field, non-object

These mirror the actual response surface of the Modifier LLM contract documented in `plan.md` §5 and `apps/server/src/modifier/modifier.types.ts`.

## Manual checklist

For releases, tick these in addition to the automated suite:

- [ ] `pnpm build` clean across the workspace
- [ ] `docker compose up -d postgres dragonfly` and `pnpm --filter @openclaw/server start` boots without crashing
- [ ] Frontend smoke: open http://localhost:5173/ and complete Setup → Lobby for one nickname
- [ ] Two-tab smoke: confirm both clients transition Setup → Lobby → Play → Voting → Results
- [ ] `curl -H 'Authorization: Bearer $ADMIN_TOKEN' http://localhost:3000/admin/export?limit=1` returns 200 and one JSONL line; same call with a wrong token returns 401
