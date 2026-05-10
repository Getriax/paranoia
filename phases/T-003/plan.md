# T-003: Single-image Dockerfile + Coolify config

## Summary

Create a multi-stage Dockerfile that builds the React frontend and NestJS backend into a single runtime image. Add a `deploy.json` manifest and `.dockerignore` so the deployer can ship the app to Coolify with correct env vars, health check, and domain routing.

## Context

T-001 scaffolded the monorepo (`apps/server`, `apps/web`, `packages/shared`). T-005 added NestJS bootstrap with health module, structured logging, Zod env validation, Dragonfly client, and `ServeStaticModule` wired to serve from `public/`. The server already:

- Listens on port 3000 (`process.env.PORT ?? 3000`)
- Has `GET /health` returning terminus-formatted JSON with postgres, dragonfly, openrouter indicators
- Serves static files from `join(__dirname, '..', '..', 'public')` via `ServeStaticModule`
- Excludes `/api/(.*)` and `/health` from static serving
- Uses `@openclaw/shared` as a workspace dependency

The React app (`apps/web`) builds to `apps/web/dist` via `vite build`.

## Deliverables

### D1. Multi-stage Dockerfile at repo root

**File:** `Dockerfile` (monorepo root)

Three stages:

**Stage 1 — `deps`** (install all workspace dependencies):
- `FROM node:22-alpine`
- Copy `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `.npmrc`
- Copy all `package.json` files for workspaces: `apps/server/package.json`, `apps/web/package.json`, `packages/shared/package.json`
- `RUN corepack enable pnpm && pnpm install --frozen-lockfile`
- Rationale: Docker layer caching — dependency installs only re-run when lockfile or package.json changes.

**Stage 2 — `build`** (compile shared, React, then NestJS):
- Copy `packages/shared/src` → build with `pnpm --filter @openclaw/shared build`
- Copy `apps/web/src` + `apps/web/vite.config.ts` + `apps/web/tsconfig.json` + `apps/web/index.html` → build with `pnpm --filter @openclaw/web build` → produces `apps/web/dist/`
- Copy `apps/server/src` + `apps/server/tsconfig.json` + `apps/server/nest-cli.json` → build with `pnpm --filter @openclaw/server build` → produces `apps/server/dist/`
- Copy `apps/web/dist/` → `apps/server/public/` (so `ServeStaticModule` serves the React SPA)
- Rationale: The `nest build` compiles TS → JS in `apps/server/dist/`. The Vite build outputs to `apps/web/dist/`. We copy React output into the server's `public/` so the single container serves both.

**Stage 3 — `runtime`** (production image):
- `FROM node:22-alpine`
- Non-root user: `addgroup -S app && adduser -S app -G app`
- Copy `package.json` + `pnpm-lock.yaml` + `pnpm-workspace.yaml` + `.npmrc`
- Copy workspace `package.json` files for prune context
- `RUN corepack enable pnpm && pnpm install --frozen-lockfile --prod`
- Copy `--from=build` the server dist (`apps/server/dist/`), the public dir (`apps/server/public/`), `drizzle.config.ts`, `seeds/` (for future migrations)
- `--chown=app:app` on all COPY commands
- `USER app`
- `EXPOSE 3000`
- `HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 CMD node -e "fetch('http://localhost:3000/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"`
- `CMD ["node", "apps/server/dist/main.js"]`
- `ENV NODE_ENV=production`

Note on CMD path: `nest build` outputs to `apps/server/dist/` relative to the monorepo root. The entry point is `apps/server/dist/main.js`.

### D2. `.dockerignore` at repo root

**File:** `.dockerignore`

```
node_modules
dist
.git
.env
.env.*
*.log
sessions/
.sessions/
*.tsbuildinfo
.DS_Store
.vscode/
.idea/
scratch/
*.pid
.tmp/
*.local
```

### D3. `deploy.json` at repo root

**File:** `deploy.json`

```json
{
  "runtime": "node",
  "dockerfile": "Dockerfile",
  "port": 3000,
  "health": {
    "path": "/health",
    "expected_status": 200,
    "expected_body_contains": "\"ok\":true"
  },
  "env_required": [
    "DATABASE_URL",
    "DRAGONFLY_URL",
    "OPENROUTER_API_KEY",
    "OPENROUTER_BASE_URL",
    "NODE_ENV"
  ],
  "env_provided": {},
  "dependencies": [
    { "kind": "postgres", "scope": "database", "name": "paranoia_db" },
    { "kind": "kv", "scope": "namespace", "name": "paranoia" }
  ],
  "resources": { "cpu": 1, "memory_mb": 512 }
}
```

Notes:
- `DATABASE_URL` maps to `POSTGRES_URL` in the env validation — the deployer must set env var `POSTGRES_URL` to the provisioned database URL (the Coolify app env var name must match `POSTGRES_URL`, not `DATABASE_URL`).
- `DRAGONFLY_URL` defaults to `redis://localhost:6379` but must be set to the Coolify-managed Dragonfly instance.
- `ADMIN_TOKEN` is optional per env validation.
- Domain `paranoia.krulestwo.com` via Traefik + Cloudflare Tunnel (already configured externally).
- FQDN must be set to `http://paranoia.krulestwo.com` (HTTP, not HTTPS — Cloudflare handles TLS termination).

### D4. Coolify app configuration

This is handled by the deployer reading `deploy.json`. The architect specifies the requirements:

- **Build pack:** `dockerfile`
- **Port:** 3000
- **FQDN:** `http://paranoia.krulestwo.com` (HTTP scheme — Cloudflare Tunnel handles TLS)
- **Branch:** `issue/HARNE-16`
- **Environment variables:**
  - `POSTGRES_URL` — from provisioned Postgres resource (mapped from `DATABASE_URL` in deploy.json)
  - `DRAGONFLY_URL` — from provisioned Dragonfly resource
  - `OPENROUTER_API_KEY` — must be provided manually
  - `OPENROUTER_BASE_URL` — `https://openrouter.ai/api/v1`
  - `ADMIN_TOKEN` — optional
  - `NODE_ENV` — `production`
- **Health check:** `GET /health` expecting 200 with `"ok":true` in body
- **Restart policy:** `unless-stopped`

## Files to create

| File | Purpose |
|---|---|
| `Dockerfile` | Multi-stage build: deps → build (shared + web + server) → runtime |
| `.dockerignore` | Exclude node_modules, dist, .git, .env, logs from Docker context |
| `deploy.json` | Deployment manifest for the deployer |

## Files NOT modified

All existing source files are correct. No changes to `apps/server/src/*`, `apps/web/src/*`, or `packages/shared/*`.

## Acceptance criteria

1. `docker build -t paranoia .` succeeds (builds without errors)
2. The runtime image contains `apps/server/dist/main.js` and `apps/server/public/index.html`
3. Container starts, `GET /health` returns 200 JSON with status info
4. Container serves React SPA on `/` with SPA fallback for client-side routes
5. Single port (3000), single container
6. `deploy.json` is valid and matches the env validation schema in `apps/server/src/env/env.validation.ts`
7. `.dockerignore` excludes `node_modules`, `dist`, `.git`, `.env`
