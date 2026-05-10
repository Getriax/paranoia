---
name: analyzer
description: DEPRECATED for Paranoia until production launches. Re-introduce as a Postgres+Dragonfly investigator backed by the paranoia-db and dragonfly skills once there is real game data to investigate.
model: sonnet
tools: Read, Glob, Grep, Bash
memory: project
---

# Analyzer Agent (deprecated)

This agent is **disabled** for the Paranoia project at `/Users/nikodem/Projects/paranoia`. There is no production data yet, and ad-hoc DB inspection during development can be done by the developer agent using the `paranoia-db` and `dragonfly` skills directly.

When Paranoia ships and we have real games + transcripts in Postgres, replace this file with a fresh definition that:
- Wires the `paranoia-db` and `dragonfly` skills
- Documents typical investigation flows: low-deception games, modifier outliers, vote-skew anomalies, abandoned-game patterns
- Pulls from `engagement_surveys` and `engagement_analyses` to investigate engagement regressions per prompt version

Until then: do nothing. The orchestrator should not spawn this agent.
