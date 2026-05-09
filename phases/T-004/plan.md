# T-004 — Seed 50 starter topics

## Summary

Create `apps/server/seeds/topics.json` containing exactly 50 conversation-starter topics distributed across 5 categories and 3 difficulty levels. Each topic must be an open prompt that invites conversation, not a closed yes/no question.

## Context

The topics seed file feeds the `topics` table in Postgres via `apps/server/src/db/seed.ts`. Topics are selected at game start as conversation starters. The `category` and `difficulty` fields allow the lobby UI to offer filters (e.g., "give me a hard creative topic").

## Acceptance criteria (from issue)

1. File exists at `apps/server/seeds/topics.json`
2. Contains exactly **50 entries**
3. Each entry has three fields: `text` (string), `category` (string), `difficulty` (string)
4. **Categories** (5 required): `relationships`, `world`, `hypothetical`, `personal`, `creative`
5. **Difficulties** (3 required): `easy`, `medium`, `hard`
6. Every entry's `text` is an **open prompt** that invites conversation — not a closed question with a yes/no/factual answer
7. Reasonable distribution across categories and difficulties (not all 50 in one bucket)

## Deliverables

### D1. `apps/server/seeds/topics.json`

JSON array of 50 objects, each shaped:

```json
{
  "text": "What's the most interesting conversation you've ever had with a stranger?",
  "category": "relationships",
  "difficulty": "medium"
}
```

**Distribution targets** (approximate, not strict):
| Category | Target count |
|---|---|
| relationships | ~10 |
| world | ~10 |
| hypothetical | ~10 |
| personal | ~10 |
| creative | ~10 |

| Difficulty | Target count |
|---|---|
| easy | ~17 |
| medium | ~17 |
| hard | ~16 |

**Topic quality guidelines:**
- **Easy**: Light, fun, low vulnerability — icebreakers anyone can answer
- **Medium**: Requires some reflection or imagination, moderate openness
- **Hard**: Deep, vulnerable, or philosophically demanding — invites sustained exploration

**Anti-patterns to avoid:**
- Closed questions ("Do you like pizza?" → yes/no)
- Quiz-style factual questions ("What year did X happen?")
- Overlapping/near-duplicate topics
- Topics that only work for specific demographics (keep them universally accessible)

## Existing state

The file `apps/server/seeds/topics.json` already exists with 50 valid entries. The seed script at `apps/server/src/db/seed.ts` already reads this file and inserts into the `topics` table. **No changes to seed.ts are needed.**

The task is to **validate** the existing file meets all criteria, or **rewrite it** if it doesn't. Based on audit:
- 50 entries ✅
- All 5 categories present ✅ (relationships: 8, world: 8, hypothetical: 10, personal: 14, creative: 10)
- All 3 difficulties present ✅ (easy: 17, medium: 18, hard: 15)
- All entries have text/category/difficulty ✅
- Topics are open prompts, not closed questions ✅

The existing file satisfies the acceptance criteria. The developer should verify and keep it as-is, or make minor quality adjustments if desired.

## File change summary

| File | Action |
|---|---|
| `apps/server/seeds/topics.json` | Verify existing / create if missing |

## Notes

- This is a content-only task. No code changes required.
- The seed script already handles loading this JSON into the `topics` table.
- Topics should be culturally neutral and appropriate for ages 13+.
