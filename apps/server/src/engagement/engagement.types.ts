import { z } from 'zod';

export const engagementAnalysisSchema = z.object({
  score: z.number().min(0).max(1),
  dimensions: z.object({
    depth: z.number().min(0).max(1),
    callbacks: z.number().min(0).max(1),
    novelty: z.number().min(0).max(1),
    coherence: z.number().min(0).max(1),
  }),
  reasoning: z.string(),
});

export type EngagementAnalysisResult = z.infer<typeof engagementAnalysisSchema>;
