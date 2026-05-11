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
const { withBootLock } = await import('./db/boot.js');
const { runMigrations } = await import('./db/migrate.js');
const { runSeed } = await import('./db/seed.js');

async function bootstrap() {
  const needsMigrate = process.env.RUN_MIGRATIONS_ON_BOOT !== 'false';
  const needsSeed = process.env.RUN_SEED_ON_BOOT !== 'false';

  if (needsMigrate || needsSeed) {
    const lockWait = Date.now();
    try {
      await withBootLock(async () => {
        // eslint-disable-next-line no-console
        console.log(`[boot] acquired init lock after ${Date.now() - lockWait}ms`);

        if (needsMigrate) {
          const t0 = Date.now();
          await runMigrations();
          // eslint-disable-next-line no-console
          console.log(`[migrate] applied in ${Date.now() - t0}ms`);
        }

        if (needsSeed) {
          const t0 = Date.now();
          const result = await runSeed();
          // eslint-disable-next-line no-console
          console.log(
            `[seed] topicsAdded=${result.topicsAdded} topicsPruned=${result.topicsPruned} promptUpdated=${result.promptUpdated} in ${Date.now() - t0}ms`,
          );
        }
      });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[boot] init failed', err);
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
