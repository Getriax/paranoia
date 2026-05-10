---
name: paranoia-db
description: Inspect Paranoia's Postgres game data via psql. Use this skill when investigating games, transcripts, modifier decisions, votes, prompts, or engagement records.
---

Use this skill to read game state from the Paranoia Postgres database. The schema is defined in `apps/server/src/db/schema.ts` and migrations live under `apps/server/drizzle/`.

## Scope
- Database: Paranoia main DB (single Postgres instance, Coolify-managed)
- Connection: `$POSTGRES_URL` from `apps/server/.env` (or shell env)
- CLI: `psql "$POSTGRES_URL"` for ad-hoc queries
- Migrations + types: Drizzle (`pnpm --filter @openclaw/server db:generate`)

## Required environment
Load from `apps/server/.env` or shell. For local dev, the value is typically `postgres://postgres:postgres@localhost:5432/paranoia`.
- `POSTGRES_URL` (required)

## Reference: tables (per plan.md §3)
- `games` — room_code, status, topic_id, current_turn, current_player_id, modifier_prompt_id, modifier_model
- `players` — game_id, nickname, position (1|2), session_token
- `messages` — game_id, player_id, turn_number, original_text, delivered_text, was_modified, modifier_strategy, modifier_reasoning, modifier_confidence, modifier_model, modifier_prompt_id, modifier_latency_ms, tokens
- `votes` — game_id, voter_id, message_id, guessed_modified
- `topics` — text, category, difficulty, active
- `prompts` — name, version, system_prompt, user_template, default_model, default_params, active
- `engagement_surveys` — rating, would_replay, comment
- `engagement_analyses` — score, dimensions JSONB, reasoning, model, prompt_id

## Common recipes

### Active prompt for the modifier
```sql
SELECT id, version, default_model, notes, created_at
FROM prompts
WHERE name = 'modifier' AND active = true
ORDER BY version DESC
LIMIT 1;
```

### Full transcript of a game by room code
```sql
SELECT m.turn_number, p.nickname, m.original_text, m.delivered_text, m.was_modified, m.modifier_strategy
FROM messages m
JOIN games g ON g.id = m.game_id
JOIN players p ON p.id = m.player_id
WHERE g.room_code = $1
ORDER BY m.turn_number, m.sent_at;
```

### Modifier behavior summary for a date range
```sql
SELECT modifier_model,
       COUNT(*) AS msgs,
       AVG(was_modified::int)::numeric(4,3) AS modify_rate,
       AVG(modifier_latency_ms)::int AS p50_latency_ms,
       SUM(modifier_input_tokens) AS in_tok,
       SUM(modifier_output_tokens) AS out_tok
FROM messages
WHERE sent_at >= $1 AND sent_at < $2
GROUP BY modifier_model
ORDER BY msgs DESC;
```

### Deception rate per game (modified messages the receiver missed)
```sql
SELECT g.room_code,
       COUNT(*) FILTER (WHERE m.was_modified) AS modified_msgs,
       COUNT(*) FILTER (WHERE m.was_modified AND v.guessed_modified IS NOT TRUE) AS missed,
       (COUNT(*) FILTER (WHERE m.was_modified AND v.guessed_modified IS NOT TRUE))::float
         / NULLIF(COUNT(*) FILTER (WHERE m.was_modified), 0) AS deception_rate
FROM games g
JOIN messages m ON m.game_id = g.id
LEFT JOIN votes v ON v.message_id = m.id AND v.voter_id <> m.player_id
WHERE g.status = 'finished'
GROUP BY g.room_code
ORDER BY deception_rate DESC NULLS LAST;
```

### Recent abandonments
```sql
SELECT room_code, status, current_turn, finished_at - started_at AS duration
FROM games
WHERE status = 'abandoned'
ORDER BY finished_at DESC
LIMIT 20;
```

### Engagement survey distribution
```sql
SELECT rating, COUNT(*), ROUND(AVG(would_replay::int)::numeric, 2) AS replay_rate
FROM engagement_surveys
GROUP BY rating
ORDER BY rating;
```

## Conventions

- **Read-only by default.** Use `psql -c "BEGIN; ... ROLLBACK"` if a query needs side effects to verify.
- **Never UPDATE/DELETE prompts or games rows ad-hoc.** Insert new versions; mark old ones inactive in a transaction.
- **Don't leak secrets.** Don't print `$POSTGRES_URL` in agent output.
- **Use Drizzle migrations** for schema changes, never raw SQL DDL.
