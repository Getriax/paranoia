#!/bin/sh
cd /app
for src_dir in node_modules-server node_modules-shared; do
  if [ -d "$src_dir" ]; then
    find "$src_dir" -type l | while read link; do
      target=$(readlink -f "$link")
      if [ -f "$target" ]; then
        dir=$(dirname "${link#*/}")
        mkdir -p "$dir"
        cp -f "$target" "$link"
      fi
    done
    cp -rn "$src_dir"/* node_modules/ 2>/dev/null || true
  fi
done
rm -rf node_modules-server node_modules-shared
echo "Flattened node_modules"
