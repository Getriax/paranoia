# --- deps ---
FROM node:22-alpine AS deps
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN pnpm install --frozen-lockfile --store-dir /tmp/pnpm-store

# --- build ---
FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app
COPY pnpm-lock.yaml pnpm-workspace.yaml .npmrc package.json tsconfig.base.json ./
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/server/node_modules ./apps/server/node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY packages/shared ./packages/shared
RUN pnpm --filter @openclaw/shared build
COPY apps/web ./apps/web
RUN pnpm --filter @openclaw/web build
COPY apps/server ./apps/server
RUN pnpm --filter @openclaw/server build

# --- flatten ---
FROM node:22-alpine AS flatten
WORKDIR /app
COPY --from=build /app/apps/server/package.json ./
# Copy all needed node_modules and resolve symlinks
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/server/node_modules ./node_modules-server
COPY --from=build /app/packages/shared/node_modules ./node_modules-shared
# Use a script to flatten symlinks
RUN node -e "
const fs = require('fs');
const path = require('path');
function flatten(src, dest) {
  if (!fs.existsSync(src)) return;
  for (const entry of fs.readdirSync(src, {withFileTypes: true})) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      if (!fs.existsSync(d)) fs.mkdirSync(d, {recursive:true});
      flatten(s, d);
    } else if (entry.isSymbolicLink()) {
      try {
        const real = fs.realpathSync(s);
        if (fs.existsSync(real)) {
          fs.copyFileSync(real, d);
        }
      } catch(e) {}
    } else {
      fs.copyFileSync(s, d);
    }
  }
}
flatten('./node_modules-server', './node_modules');
flatten('./node_modules-shared', './node_modules');
console.log('Flattened node_modules');
"
RUN rm -rf node_modules-server node_modules-shared

# --- runtime ---
FROM node:22-alpine AS runtime
RUN apk add --no-cache wget && addgroup -S app && adduser -S app -G app
WORKDIR /app
COPY --from=build /app/apps/server/dist ./dist
COPY --from=build /app/apps/web/dist ./public
COPY --from=flatten /app/node_modules ./node_modules
COPY --from=flatten /app/package.json ./
USER app
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1
CMD ["node", "dist/main.js"]
