import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { SessionService } from './session.service.js';

@Module({
  providers: [GameGateway, SessionService],
  exports: [SessionService],
})
export class WsModule {}
