import { Injectable } from '@nestjs/common';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import { prompt } from '../db/schema.js';

type Prompt = typeof prompt.$inferSelect;

const CACHE_TTL_MS = 60_000;

interface CacheEntry {
  prompt: Prompt | null;
  expiresAt: number;
}

@Injectable()
export class PromptsCache {
  private readonly activeCache = new Map<string, CacheEntry>();
  private readonly byIdCache = new Map<string, CacheEntry>();

  async getActive(name: string): Promise<Prompt | null> {
    const cached = this.activeCache.get(name);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.prompt;
    }

    const [row] = await db
      .select()
      .from(prompt)
      .where(and(eq(prompt.name, name), eq(prompt.isActive, true)))
      .orderBy(sql`${prompt.version} DESC`)
      .limit(1);

    const entry: CacheEntry = {
      prompt: row ?? null,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.activeCache.set(name, entry);
    return entry.prompt;
  }

  async getById(id: string): Promise<Prompt | null> {
    const cached = this.byIdCache.get(id);
    if (cached && Date.now() < cached.expiresAt) {
      return cached.prompt;
    }

    const [row] = await db
      .select()
      .from(prompt)
      .where(eq(prompt.id, id))
      .limit(1);

    const entry: CacheEntry = {
      prompt: row ?? null,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };
    this.byIdCache.set(id, entry);
    return entry.prompt;
  }
}
