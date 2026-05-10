import { Module } from '@nestjs/common';
import { GameGateway } from './game.gateway.js';
import { SessionModule } from '../session/session.module.js';
import { LobbyModule } from '../lobby/lobby.module.js';
import { GameModule } from '../game/game.module.js';
import { VotingModule } from '../voting/voting.module.js';
import { EngagementModule } from '../engagement/engagement.module.js';

@Module({
  imports: [SessionModule, LobbyModule, GameModule, VotingModule, EngagementModule],
  providers: [GameGateway],
})
export class WsModule {}
