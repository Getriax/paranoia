import { Module } from '@nestjs/common';
import { ModifierService } from './modifier.service.js';
import { OpenRouterClient } from './openrouter.client.js';
import { PromptsCache } from './prompts.cache.js';

@Module({
  providers: [OpenRouterClient, PromptsCache, ModifierService],
  exports: [ModifierService],
})
export class ModifierModule {}
