import { Module } from '@nestjs/common';
import { EngagementService } from './engagement.service.js';
import { EngagementWorker } from './engagement.worker.js';
import { OpenRouterClient } from './openrouter.client.js';

@Module({
  providers: [OpenRouterClient, EngagementWorker, EngagementService],
  exports: [EngagementService],
})
export class EngagementModule {}
