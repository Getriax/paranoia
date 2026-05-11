import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  POSTGRES_URL: z.string().url(),
  DRAGONFLY_URL: z.string().url().default('redis://localhost:6379'),
  OPENROUTER_API_KEY: z.string().min(1),
  OPENROUTER_BASE_URL: z.string().url().default('https://openrouter.ai/api/v1'),
  MODIFIER_DEFAULT_MODEL: z.string().min(1).default('deepseek/deepseek-v4-flash'),
  ENGAGEMENT_ANALYSIS_ENABLED: z.enum(['true', 'false']).default('true'),
  ENGAGEMENT_MODEL: z.string().min(1).optional(),
  ADMIN_TOKEN: z.string().min(1).optional(),
  RUN_MIGRATIONS_ON_BOOT: z.enum(['true', 'false']).default('true'),
  RUN_SEED_ON_BOOT: z.enum(['true', 'false']).default('true'),
});

export type Env = z.infer<typeof envSchema>;
