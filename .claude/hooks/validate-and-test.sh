#!/bin/bash
# Hook: Pre-stop validation
# Triggered by the Stop event to ensure validator/tester/web-validator
# agents run on packages that had file changes during this session.

set -euo pipefail

INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')
STOP_HOOK_ACTIVE=$(echo "$INPUT" | jq -r '.stop_hook_active // false')

# Prevent infinite loops
if [ "$STOP_HOOK_ACTIVE" = "true" ]; then
  exit 0
fi

BASE_DIR="/Users/nikodem/Projects/paranoia"
TRACKING_DIR="/tmp/claude-changed-paths"
TRACKING_FILE="$TRACKING_DIR/$SESSION_ID.txt"

if [ ! -f "$TRACKING_FILE" ]; then
  exit 0
fi

# Map every tracked path to its package (apps/server, apps/web, packages/shared)
# and dedupe. Worktree paths are normalized to the repo-relative form.
CHANGED_PACKAGES=$(while IFS= read -r path; do
  # Normalize worktree paths: strip /.claude/worktrees/<id>/ prefix
  rel=$(echo "$path" | sed -E "s|^$BASE_DIR/\.claude/worktrees/[^/]+/||")
  rel="${rel#$BASE_DIR/}"
  case "$rel" in
    apps/server/*)     echo "apps/server" ;;
    apps/web/*)        echo "apps/web" ;;
    packages/shared/*) echo "packages/shared" ;;
    *) ;;
  esac
done < "$TRACKING_FILE" | sort -u)

if [ -z "$CHANGED_PACKAGES" ]; then
  rm -f "$TRACKING_FILE"
  exit 0
fi

PKG_LIST=$(echo "$CHANGED_PACKAGES" | tr '\n' ', ' | sed 's/,$//')

cat <<EOF
{
  "decision": "block",
  "reason": "Before completing, run these three agents IN PARALLEL on the changed Paranoia packages: ${PKG_LIST}. Focus only on files changed in this session (tracked in ${TRACKING_FILE}).\n\n1. **validator** (subagent_type='validator'): Paranoia-specific risk review — Socket.IO auth, turn ownership, state transitions, modifier fallback, prompt-injection from user messages, rate limits, admin-token leakage.\n2. **tester** (subagent_type='tester'): Run pnpm test suites for changed packages, analyze coverage on changed lines, list missing scenarios.\n3. **web-validator** (subagent_type='web-validator'): Research known issues for libraries we touched (NestJS 11, Socket.IO 4.8, Drizzle, ioredis/Dragonfly, OpenRouter, React 19, Vite 6).\n\nAfter ALL THREE complete, summarize their findings together."
}
EOF

rm -f "$TRACKING_FILE"

exit 0
