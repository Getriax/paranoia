import { Module } from '@nestjs/common';
import { VotingService } from './voting.service.js';
import { EngagementModule } from '../engagement/engagement.module.js';

@Module({
  imports: [EngagementModule],
  providers: [VotingService],
  exports: [VotingService],
})
export class VotingModule {}
