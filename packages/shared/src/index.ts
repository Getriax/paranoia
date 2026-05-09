import { z } from 'zod';

export const AppConfigSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export type AppConfig = z.infer<typeof AppConfigSchema>;
