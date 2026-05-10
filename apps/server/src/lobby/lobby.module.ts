import { Module } from '@nestjs/common';
import { LobbyService } from './lobby.service.js';
import { SessionModule } from '../session/session.module.js';

@Module({
  imports: [SessionModule],
  providers: [LobbyService],
  exports: [LobbyService],
})
export class LobbyModule {}
