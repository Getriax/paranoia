import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module.js';

async function bootstrap() {
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
