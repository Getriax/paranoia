# T-005: NestJS Bootstrap + Health Module

## Summary

Upgrade the bare NestJS scaffold (created by T-001/T--002) into a production-ready bootstrap with structured logging, validated configuration, a real health endpoint, graceful shutdown, and static file serving for the React frontend.

## Current state

The existing `apps/server` has:
- `src/main.ts` — minimal `NestFactory.create(AppModule)` + `app.listen(3000)`. No logging, no shutdown hooks, no CORS.
- `src/app.module.ts` — bare module with `AppController` only.
- `src/app.controller.ts` — stub `GET /health` returning `{ status: 'ok' }` (no actual checks).
- `src/db/client.ts` — drizzle + postgres client using `POSTGRES_URL` env var.
- `src/db/schema.ts` — full schema (games, players, messages, votes, topics, prompts, engagement).
- `package.json` — NestJS 11, drizzle-orm, postgres, no pino/config/health deps yet.
- No `ServeStaticModule`, no `ConfigModule`, no `LoggerModule`.

## Target state

### 1. Install new dependencies

Add to `apps/server/package.json` dependencies:

```
nestjs-pino
pino-http
pino-pretty          (devDep — local dev formatting)
@nestjs/config
@nestjs/serve-static
@nestjs/terminus
ioredis
zod
```

### 2. Environment validation with Zod — `src/env/env.validation.ts`

Create `src/env/env.validation.ts` exporting a Zod schema. Use `@nestjs/config` `validatedConfig` factory pattern:

```ts
import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  POSTGRES_URL: z.string().url(),
  DRAGONFLY_URL: z.string().url().default('redis://localhost:6379'),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  ADMIN_TOKEN: z.string().min(1).optional(),
});

export type Env = z.infer<typeof envSchema>;
```

Wire into `ConfigModule.forRoot({ validate: ... })`.

### 3. Structured logging — `src/logger/logger.module.ts`

Create a `LoggerModule` wrapping `LoggerModule` from `nestjs-pino`:

```ts
import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';

@Module({
  imports: [
    PinoLoggerModule.forRoot({
      pinoHttp: {
        transport: process.env.NODE_ENV !== 'production'
          ? { target: 'pino-pretty', options: { colorize: true } }
          : undefined,
        level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
      },
    }),
  ],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
```

Use `app.useLogger(app.get(Logger))` in bootstrap.

### 4. Dragonfly (Redis) client — `src/db/dragonfly.ts`

Create `src/db/dragonfly.ts`:

```ts
import Redis from 'ioredis';

export const dragonfly = new Redis(process.env.DRAGONFLY_URL!, {
  maxRetriesPerRequest: 3,
  lazyConnect: true,
});
```

### 5. Health module — `src/health/health.module.ts`, `src/health/health.controller.ts`, `src/health/health.service.ts`

Create `src/health/` directory with:

**`health.module.ts`** — imports `TerminusModule`, provides `HealthService`.

**`health.service.ts`** — injects DB and Dragonfly clients. Implements three health indicator methods:

1. **Postgres check** — `SELECT 1` via the existing drizzle `db` client. Return `{'postgres': { status: 'up' }}` or throw.
2. **Dragonfly check** — `dragonfly.ping()`. Return `{'dragonfly': { status: 'up' }}` or throw.
3. **OpenRouter reachability check** — HTTP `GET https://openrouter.ai/api/v1/models` with the API key as `Authorization: Bearer <key>`. Verify 200 response. Return `{'openrouter': { status: 'up' }}` or throw.

**`health.controller.ts`** — single `@Get('health')` endpoint using `@HealthCheck()` decorator. Calls all three checks via `HealthCheckService`.

```ts
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private healthService: HealthService,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.healthService.checkPostgres(),
      () => this.healthService.checkDragonfly(),
      () => this.healthService.checkOpenRouter(),
    ]);
  }
}
```

### 6. ServeStaticModule — serve React build

In `app.module.ts`, add `ServeStaticModule`:

```ts
ServeStaticModule.forRoot({
  rootPath: join(__dirname, '..', '..', 'public'),
  exclude: ['/api/(.*)', '/health'],
})
```

The React build output from `apps/web/dist` will be copied into `apps/server/public/` during Docker build (outside this ticket's scope — T-005 just configures the module).

### 7. Updated `app.module.ts`

```ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'node:path';
import { LoggerModule } from './logger/logger.module.js';
import { HealthModule } from './health/health.module.js';
import { envSchema } from './env/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', 'public'),
      exclude: ['/api/(.*)', '/health'],
    }),
    HealthModule,
  ],
})
export class AppModule {}
```

Remove the old `AppController` — its `/health` stub is replaced by the real `HealthController`.

### 8. Updated `main.ts` — graceful shutdown + logger

```ts
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  // CORS — allow same-origin for dev, restricted in production
  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Paranoia server listening on port ${port}`);
}

bootstrap();
```

### 9. Delete old `app.controller.ts`

Remove `apps/server/src/app.controller.ts` — its stub `/health` is replaced by the health module.

## Files to create

| File | Purpose |
|---|---|
| `apps/server/src/env/env.validation.ts` | Zod schema for env vars |
| `apps/server/src/logger/logger.module.ts` | nestjs-pino wrapper |
| `apps/server/src/db/dragonfly.ts` | ioredis client for Dragonfly |
| `apps/server/src/health/health.module.ts` | Terminus health module |
| `apps/server/src/health/health.controller.ts` | `/health` endpoint |
| `apps/server/src/health/health.service.ts` | Postgres + Dragonfly + OpenRouter checks |

## Files to modify

| File | Change |
|---|---|
| `apps/server/src/main.ts` | Add pino logger, enableShutdownHooks, CORS, port from config |
| `apps/server/src/app.module.ts` | Replace bare module with ConfigModule + LoggerModule + ServeStaticModule + HealthModule. Remove AppController. |
| `apps/server/package.json` | Add new dependencies |

## Files to delete

| File | Reason |
|---|---|
| `apps/server/src/app.controller.ts` | Replaced by `health/health.controller.ts` |

## Acceptance criteria

1. `pnpm build` compiles without errors in `apps/server`
2. `GET /health` returns terminus-formatted JSON with `postgres`, `dragonfly`, `openrouter` indicators
3. Structured JSON logs via pino (pretty-printed in dev)
4. App fails to start if required env vars (`POSTGRES_URL`, `OPENROUTER_API_KEY`) are missing
5. `SIGTERM` / `SIGINT` triggers graceful shutdown
6. ServeStaticModule configured to serve from `public/` (excluding `/health` and any future `/api/*` routes)
