---
name: Modifier never blocks a turn
description: On any LLM/transport failure, deliver the original message and continue the game.
type: feedback
---

The modifier path is non-blocking. If OpenRouter times out (>8s), returns invalid JSON, errors, or rate-limits, the server MUST persist the message with `was_modified=false`, set `delivered_text = original_text`, log a warn with full context, and emit `game:message_received` to the receiver.

**Why:** the game loop is the product. A single failed modifier call cannot stall a turn — that is a worse experience than seeing an unmodified message. The product depends on conversational continuity; the modifier is a multiplicative effect on top.

**How to apply:** any code path that calls OpenRouter (modifier, engagement analysis, summary) must wrap calls in try/catch with explicit fallback. Never `await` an LLM call without a timeout. Never let an exception propagate past the gateway boundary. Track failures via metrics, not by failing the user request.
