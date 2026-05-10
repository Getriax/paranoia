import { Injectable } from '@nestjs/common';
import { HealthIndicator, HealthIndicatorResult } from '@nestjs/terminus';
import { db } from '../db/client.js';
import { dragonfly } from '../db/dragonfly.js';
import { sql } from 'drizzle-orm';

@Injectable()
export class HealthService extends HealthIndicator {
  async checkPostgres(): Promise<HealthIndicatorResult> {
    try {
      await db.execute(sql`SELECT 1`);
      return this.getStatus('postgres', true);
    } catch {
      return this.getStatus('postgres', false);
    }
  }

  async checkDragonfly(): Promise<HealthIndicatorResult> {
    try {
      await dragonfly.ping();
      return this.getStatus('dragonfly', true);
    } catch {
      return this.getStatus('dragonfly', false);
    }
  }

  async checkOpenRouter(): Promise<HealthIndicatorResult> {
    try {
      const res = await fetch('https://openrouter.ai/api/v1/models', {
        headers: { Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}` },
      });
      const up = res.status === 200;
      return this.getStatus('openrouter', up);
    } catch {
      return this.getStatus('openrouter', false);
    }
  }
}
