#!/bin/bash
# Hook: Lint and format files after write/edit operations.
# Triggered by PostToolUse on Write and Edit tools.
#
# Detects which package the file belongs to (apps/server, apps/web,
# packages/shared) and runs ESLint --fix + Prettier scoped to that package.

set -euo pipefail

INPUT=$(cat)
FILE_PATH=$(echo "$INPUT" | jq -r '.tool_input.file_path // empty')

if [ -z "$FILE_PATH" ]; then
  exit 0
fi

# Only process JS/TS source files
case "$FILE_PATH" in
  *.js|*.jsx|*.ts|*.tsx|*.mjs|*.cjs) ;;
  *) exit 0 ;;
esac

BASE_DIR="/Users/nikodem/Projects/paranoia"

# Resolve to a base repo path. If the edit happened in a worktree,
# use the worktree as BASE_DIR for package resolution.
RESOLVED="$FILE_PATH"
case "$RESOLVED" in
  "$BASE_DIR/.claude/worktrees/"*)
    WT_ROOT=$(echo "$RESOLVED" | sed -E "s|($BASE_DIR/\.claude/worktrees/[^/]+)/.*|\1|")
    BASE_DIR="$WT_ROOT"
    ;;
esac

RELATIVE="${RESOLVED#$BASE_DIR/}"

PKG_DIR=""
case "$RELATIVE" in
  apps/server/*)     PKG_DIR="$BASE_DIR/apps/server" ;;
  apps/web/*)        PKG_DIR="$BASE_DIR/apps/web" ;;
  packages/shared/*) PKG_DIR="$BASE_DIR/packages/shared" ;;
  *) exit 0 ;;
esac

# Skip if package has no node_modules yet (fresh clone)
if [ ! -d "$PKG_DIR/node_modules" ]; then
  exit 0
fi

# Run ESLint --fix scoped to the single file
if [ -f "$PKG_DIR/eslint.config.js" ] || [ -f "$PKG_DIR/eslint.config.mjs" ] \
   || [ -f "$PKG_DIR/.eslintrc" ] || [ -f "$PKG_DIR/.eslintrc.js" ] || [ -f "$PKG_DIR/.eslintrc.json" ]; then
  (cd "$PKG_DIR" && npx --no-install eslint --fix "$RESOLVED" 2>/dev/null) || true
fi

# Run Prettier if a config exists at root or package level
for cfg in .prettierrc .prettierrc.js .prettierrc.json .prettierrc.yml prettier.config.js prettier.config.mjs; do
  if [ -f "$BASE_DIR/$cfg" ] || [ -f "$PKG_DIR/$cfg" ]; then
    (cd "$PKG_DIR" && npx --no-install prettier --write "$RESOLVED" 2>/dev/null) || true
    break
  fi
done

exit 0
