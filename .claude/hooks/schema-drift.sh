#!/bin/bash
# Hook: Warn when Drizzle schema changes without a matching migration.
# Triggered by PostToolUse on Write/Edit.
#
# If apps/server/src/db/schema.ts was just modified, emit a reminder to run
# `pnpm --filter @openclaw/server db:generate`. Non-blocking — informational.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Match schema.ts in any worktree variant
case "$FILE_PATH" in
  */apps/server/src/db/schema.ts) ;;
  *) exit 0 ;;
esac

# Locate the package dir (could be in a worktree)
PKG_DIR="${FILE_PATH%/src/db/schema.ts}"

# If there's no drizzle/ directory yet, just remind to generate
if [ ! -d "$PKG_DIR/drizzle" ]; then
  echo "Drizzle schema modified. Run: pnpm --filter @openclaw/server db:generate" >&2
  exit 0
fi

# Compare schema.ts mtime to the newest migration. If schema is newer, remind.
SCHEMA_MTIME=$(stat -f %m "$FILE_PATH" 2>/dev/null || stat -c %Y "$FILE_PATH" 2>/dev/null || echo 0)
LATEST_MIGRATION=$(ls -t "$PKG_DIR/drizzle"/*.sql 2>/dev/null | head -n1 || true)

if [ -z "$LATEST_MIGRATION" ]; then
  echo "Drizzle schema modified, no migrations exist yet. Run: pnpm --filter @openclaw/server db:generate" >&2
  exit 0
fi

MIGRATION_MTIME=$(stat -f %m "$LATEST_MIGRATION" 2>/dev/null || stat -c %Y "$LATEST_MIGRATION" 2>/dev/null || echo 0)

if [ "$SCHEMA_MTIME" -gt "$MIGRATION_MTIME" ]; then
  echo "Drizzle schema is newer than the latest migration ($LATEST_MIGRATION). Run: pnpm --filter @openclaw/server db:generate" >&2
fi

exit 0
