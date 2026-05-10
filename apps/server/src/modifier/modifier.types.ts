import { z } from 'zod';

export const modifierStrategyEnum = z.enum([
  'stylistic',
  'sense_shift',
  'injection',
  'rewrite',
]);
export type ModifierStrategy = z.infer<typeof modifierStrategyEnum>;

export const modifierResponseSchema = z.object({
  modify: z.boolean(),
  strategy: modifierStrategyEnum.nullable().optional(),
  modified_message: z.string().optional(),
  reasoning: z.string().optional(),
  confidence_will_fool: z.number().min(0).max(1).optional(),
});
export type ModifierResponse = z.infer<typeof modifierResponseSchema>;

export type TranscriptEntry = {
  playerId: string;
  nickname: string;
  text: string;
  turnNumber: number;
};

export type ModifierInput = {
  topic: string;
  transcript: TranscriptEntry[];
  currentTurnNumber: number;
  totalTurns: number;
  modificationsSoFar: number;
  currentMessage: string;
  currentPlayerNickname: string;
  promptId: string;
  model: string;
};

export type ModifierDecision = {
  deliveredText: string;
  wasModified: boolean;
  strategy: ModifierStrategy | null;
  reasoning: string | null;
  confidence: number | null;
  latencyMs: number;
  inputTokens: number | null;
  outputTokens: number | null;
  fallback: boolean;
  fallbackReason?: 'timeout' | 'invalid_json' | 'network' | 'rate_limited' | 'http_error';
};
