import { config as loadEnv } from 'dotenv';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

loadEnv({ path: join(__dirname, '..', '..', '..', '.env') });
loadEnv({ path: join(__dirname, '..', '.env') });

const { NestFactory } = await import('@nestjs/core');
const { Logger } = await import('nestjs-pino');
const { AppModule } = await import('./app.module.js');
const { runMigrations } = await import('./db/migrate.js');

async function bootstrap() {
  if (process.env.RUN_MIGRATIONS_ON_BOOT !== 'false') {
    const startedAt = Date.now();
    try {
      await runMigrations();
      // eslint-disable-next-line no-console
      console.log(`[migrate] applied in ${Date.now() - startedAt}ms`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[migrate] failed', err);
      process.exit(1);
    }
  }

  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  app.useLogger(app.get(Logger));
  app.enableShutdownHooks();

  app.enableCors({
    origin: process.env.NODE_ENV === 'production' ? false : true,
  });

  const port = process.env.PORT ?? 3000;
  await app.listen(port);

  const logger = app.get(Logger);
  logger.log(`Paranoia server listening on port ${port}`);
}

bootstrap();
