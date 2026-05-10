---
name: openrouter
description: Test prompts and modifier outputs against OpenRouter models. Use this skill when iterating on the modifier or engagement-analysis prompts, or when validating a model swap.
---

Use this skill to call OpenRouter directly without going through the running server. Useful for prompt iteration, model A/B comparison, and validating the modifier JSON contract before committing prompt changes.

## Scope
- Provider: OpenRouter (`https://openrouter.ai/api/v1`)
- Endpoint: `/chat/completions` (OpenAI-compatible)
- CLI: `node skills/openrouter.mjs` (in the repo root `skills/` directory)

## Required environment
Load from `apps/server/.env` (or shell):
- `OPENROUTER_API_KEY` (required)
- `OPENROUTER_BASE_URL` (default `https://openrouter.ai/api/v1`)

## Model id format
`provider/model-name`. Examples:
- `deepseek/deepseek-v4-flash` — **current default** (fast, cheap, strong instruction-following)
- `anthropic/claude-haiku-4.5` — Claude alternative, slightly higher latency
- `anthropic/claude-sonnet-4.6` — higher capability, higher cost
- `openai/gpt-4o-mini` — OpenAI baseline
- `meta-llama/llama-3.1-70b-instruct` — open-weight option
- `z-ai/glm-4-9b` — small open-weight, fine-tune candidate

The default is sourced from `MODIFIER_DEFAULT_MODEL` env var (defaults to `deepseek/deepseek-v4-flash`). Override per-call with `--model`.

## Core commands

### Single-shot completion
```bash
node skills/openrouter.mjs \
  --model "deepseek/deepseek-v4-flash" \
  --system "You are a helpful assistant." \
  --user "Say hi in one word."
```

### JSON-mode completion (modifier-style)
```bash
node skills/openrouter.mjs \
  --model "deepseek/deepseek-v4-flash" \
  --json \
  --system-file ./prompts/modifier-v1.system.txt \
  --user-file ./prompts/sample-turn.user.txt
```

### Run a fixture set
```bash
node skills/openrouter.mjs \
  --model "deepseek/deepseek-v4-flash" \
  --json \
  --system-file ./prompts/modifier-v1.system.txt \
  --fixtures ./prompts/fixtures/*.json
```

### Health check
```bash
node skills/openrouter.mjs --health
```

## Modifier output contract (validate against this)

```json
{
  "modify": true,
  "strategy": "stylistic|sense_shift|injection|rewrite",
  "modified_message": "...",
  "reasoning": "...",
  "confidence_will_fool": 0.7
}
```

The CLI prints the raw response and a parse status. Use it before committing a new prompt version.

## Conventions

- **Never echo `OPENROUTER_API_KEY` in output.** The CLI redacts headers in its debug mode.
- **Cost guard:** the CLI defaults to `max_tokens=512` and prints token usage per call.
- **Model swaps:** when proposing a new default, run the same fixtures against both old and new models and compare parse rate, latency, and cost.
- **Prompt iteration belongs to the prompt-engineer agent.** Code-side calls go through `apps/server/src/modifier/`.
