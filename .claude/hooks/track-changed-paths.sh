#!/bin/bash
# Hook: Track file paths changed during this session
# Triggered by PostToolUse on Write and Edit tools
#
# Appends the edited file path to a session-specific tracking file
# so the Stop hook can determine which services need validation/testing.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -z "$FILE_PATH" ] || [ -z "$SESSION_ID" ]; then
  exit 0
fi

TRACKING_DIR="/tmp/claude-changed-paths"
mkdir -p "$TRACKING_DIR"
TRACKING_FILE="$TRACKING_DIR/$SESSION_ID.txt"

# Append path if not already tracked
if ! grep -qxF "$FILE_PATH" "$TRACKING_FILE" 2>/dev/null; then
  echo "$FILE_PATH" >> "$TRACKING_FILE"
fi

exit 0
