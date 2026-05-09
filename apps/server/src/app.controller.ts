import { Controller, Get } from '@nestjs/common';
import type { AppConfig } from '@openclaw/shared';

@Controller()
export class AppController {
  @Get('health')
  health(): AppConfig {
    return { name: 'openclaw-server', version: '0.0.1' };
  }
}
