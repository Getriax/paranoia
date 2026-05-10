#!/bin/sh
cd /app
# The .pnpm store is in root node_modules - copy it
if [ -d "node_modules/.pnpm" ]; then
  echo "Found .pnpm store in root node_modules"
fi
# Copy server-specific symlinks (these point to ../../.pnpm/...)
if [ -d "node_modules-server" ]; then
  for link in node_modules-server/*; do
    name=$(basename "$link")
    if [ ! -e "node_modules/$name" ]; then
      cp -rn "$link" "node_modules/$name" 2>/dev/null || true
      # If it was a symlink, resolve it
      if [ -L "$link" ]; then
        target=$(readlink -f "$link")
        if [ -d "$target" ]; then
          cp -rn "$target" "node_modules/$name" 2>/dev/null || true
        elif [ -f "$target" ]; then
          cp -n "$target" "node_modules/$name" 2>/dev/null || true
        fi
      fi
    fi
  done
fi
# Copy shared-specific symlinks
if [ -d "node_modules-shared" ]; then
  for link in node_modules-shared/*; do
    name=$(basename "$link")
    if [ ! -e "node_modules/$name" ]; then
      cp -rn "$link" "node_modules/$name" 2>/dev/null || true
    fi
  done
fi
rm -rf node_modules-server node_modules-shared
echo "Flattened node_modules"
