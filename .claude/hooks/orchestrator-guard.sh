#!/bin/bash
# Blocks orchestrator from using Edit/Write directly.
# Scoped to orchestrator agent via its frontmatter hooks.
echo "BLOCKED: You are the orchestrator. You MUST NOT use Edit/Write directly. Spawn a developer agent via the Agent tool (subagent_type='developer') to make code changes. Your role is: research → plan → delegate → summarize."
exit 2
