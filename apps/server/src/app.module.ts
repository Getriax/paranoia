import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
import { LoggerModule } from './logger/logger.module.js';
import { HealthModule } from './health/health.module.js';
import { WsModule } from './ws/ws.module.js';
import { SessionModule } from './session/session.module.js';
import { LobbyModule } from './lobby/lobby.module.js';
import { GameModule } from './game/game.module.js';
import { VotingModule } from './voting/voting.module.js';
import { ModifierModule } from './modifier/modifier.module.js';
import { EngagementModule } from './engagement/engagement.module.js';
import { AdminModule } from './admin/admin.module.js';
import { envSchema } from './env/env.validation.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        join(__dirname, '..', '..', '..', '.env'),
        join(__dirname, '..', '.env'),
      ],
      validate: (config) => envSchema.parse(config),
    }),
    LoggerModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', 'public'),
      exclude: ['/api/*', '/health', '/admin/*'],
    }),
    HealthModule,
    SessionModule,
    ModifierModule,
    EngagementModule,
    LobbyModule,
    GameModule,
    VotingModule,
    WsModule,
    AdminModule,
  ],
})
export class AppModule {}
