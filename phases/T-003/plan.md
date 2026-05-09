# T-003 — Single-image Dockerfile + Coolify config

## Summary

Create the Docker + Coolify deployment foundation: a multi-stage Dockerfile that builds both the React frontend and NestJS backend into a single runtime image, a `deploy.json` manifest for the deployer, a `.dockerignore`, and the NestJS wiring needed to serve the React SPA and expose a health endpoint.

## Deliverables

### D1. Multi-stage Dockerfile (repo root)

Create `Dockerfile` at the repo root with three stages:

1. **deps** — `node:22-alpine`, install all workspace deps with `pnpm install --frozen-lockfile`
2. **build** — copy source, build `packages/shared` first, then `apps/web` (React → `apps/web/dist`), then `apps/server` (NestJS → `apps/server/dist`)
3. **runtime** — `node:22-alpine`, non-root user `app`, copy `apps/server/dist`, `apps/web/dist` (→ `public/`), production `node_modules`, `apps/server/package.json`. `EXPOSE 3000`. `HEALTHCHECK` hitting `/health`. `CMD ["node", "dist/main.js"]`.

Key details:
- Use `corepack enable pnpm` in each stage
- The pnpm monorepo needs workspace awareness. Copy `pnpm-workspace.yaml`, `tsconfig.base.json`, `.npmrc` into the build stage
- Install prod deps only in runtime: `pnpm deploy --prod` from `apps/server` or equivalent
- React build output goes to a directory the NestJS `ServeStaticModule` can serve
- Runtime WORKDIR should be `/app`
- Copy `apps/web/dist` into `/app/public/` so `@nestjs/serve-static` finds it

### D2. deploy.json (repo root)

Create `deploy.json` at the repo root:

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
    "ADMIN_TOKEN",
    "NODE_ENV"
  ],
  "env_provided": {},
  "dependencies": [
    { "kind": "postgres", "scope": "database", "name": "paranoia" },
    { "kind": "kv", "scope": "namespace", "name": "paranoia" }
  ],
  "resources": { "cpu": 1, "memory_mb": 512 }
}
```

### D3. .dockerignore (repo root)

Create `.dockerignore` excluding:
```
node_modules
dist
.git
.env
.env.*
*.log
sessions/
dashboard/
db/
runner/
harness/
.vscode/
coverage/
```

### D4. ServeStaticModule in AppModule

Modify `apps/server/src/app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { AppController } from './app.controller.js';

@Module({
  imports: [
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/(.*)', '/health'],
    }),
  ],
  controllers: [AppController],
})
export class AppModule {}
```

This serves React from `public/` for all routes except `/api/*` and `/health`.

### D5. /health endpoint in AppController

Modify `apps/server/src/app.controller.ts` to return `{ ok: true, ts: <ISO string> }`:

```typescript
import { Controller, Get } from '@nestjs/common';

@Controller()
export class AppController {
  @Get('health')
  health() {
    return { ok: true, ts: new Date().toISOString() };
  }
}
```

Note: the key must be `ok` (boolean `true`) to match the `deploy.json` `expected_body_contains` of `"\"ok\":true"`.

### D6. Add @nestjs/serve-static dependency

Add to `apps/server/package.json` dependencies:

```
"@nestjs/serve-static": "^5.0.0"
```

## File change summary

| File | Action |
|---|---|
| `Dockerfile` | Create |
| `deploy.json` | Create |
| `.dockerignore` | Create |
| `apps/server/src/app.module.ts` | Modify (add ServeStaticModule) |
| `apps/server/src/app.controller.ts` | Modify (return `{ ok: true, ts }`) |
| `apps/server/package.json` | Modify (add @nestjs/serve-static) |

## Notes

- This phase is infra-only. No game logic, no WebSocket, no database schemas.
- The health endpoint does NOT need to check Postgres/Dragonfly reachability yet (those deps aren't wired). It just returns `{ ok: true, ts }` to confirm the container is alive.
- The Dockerfile must work with the pnpm workspace structure. The key challenge is that `pnpm install` at root level creates symlinks; `pnpm deploy --prod` can extract a flat node_modules for a specific workspace package.
- `apps/web` build output is `apps/web/dist/`. In the Dockerfile, this must be copied to `/app/public/` in the runtime stage so `ServeStaticModule` with `rootPath: join(__dirname, '..', 'public')` resolves to `/app/public`.
