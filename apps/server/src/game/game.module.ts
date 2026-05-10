import { Module } from '@nestjs/common';
import { GameService } from './game.service.js';
import { ModifierModule } from '../modifier/modifier.module.js';

@Module({
  imports: [ModifierModule],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
