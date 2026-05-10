import { Injectable, Logger } from '@nestjs/common';
import { modifierResponseSchema } from './modifier.types.js';
import type { ModifierInput, ModifierDecision, ModifierStrategy } from './modifier.types.js';
import { OpenRouterClient, OpenRouterTimeoutError, OpenRouterNetworkError, OpenRouterRateLimitedError, OpenRouterHttpError } from './openrouter.client.js';
import { PromptsCache } from './prompts.cache.js';

const TRANSCRIPT_CHAR_LIMIT = 6000;
const TRANSCRIPT_TAIL_KEEP = 8;

@Injectable()
export class ModifierService {
  private readonly logger = new Logger(ModifierService.name);

  constructor(
    private readonly client: OpenRouterClient,
    private readonly prompts: PromptsCache,
  ) {}

  async modify(input: ModifierInput): Promise<ModifierDecision> {
    if (!this.client.enabled) {
      this.logger.debug(
        `modifier passthrough (mock): turn=${input.currentTurnNumber}/${input.totalTurns}`,
      );
      return this.passthrough(input, 'network');
    }

    const t0 = Date.now();

    let promptRow: Awaited<ReturnType<PromptsCache['getById']>>;
    if (input.promptId) {
      promptRow = await this.prompts.getById(input.promptId);
    } else {
      promptRow = null;
    }

    if (!promptRow) {
      this.logger.warn(
        `modifier fallback: prompt not found promptId=${input.promptId} model=${input.model} turn=${input.currentTurnNumber}`,
      );
      return this.passthrough(input, 'invalid_json');
    }

    const userMsg = this.buildUserMessage(input);

    try {
      const response = await this.client.complete({
        model: input.model,
        messages: [
          { role: 'system', content: promptRow.systemPrompt },
          { role: 'user', content: userMsg },
        ],
        temperature: 0.7,
        max_tokens: 512,
        response_format: { type: 'json_object' },
      });

      const latencyMs = Date.now() - t0;
      const content = response.choices[0]?.message?.content ?? '';

      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        this.logger.warn(
          `modifier fallback: JSON.parse failed model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} content=${content.slice(0, 120)}`,
        );
        return { ...this.passthrough(input, 'invalid_json'), latencyMs };
      }

      // Strip null values for optional-but-not-nullable fields before schema validation.
      // LLMs sometimes emit `"field": null` instead of omitting the key.
      if (parsed !== null && typeof parsed === 'object') {
        const obj = parsed as Record<string, unknown>;
        for (const key of ['modified_message', 'reasoning', 'confidence_will_fool'] as const) {
          if (obj[key] === null) delete obj[key];
        }
      }

      const result = modifierResponseSchema.safeParse(parsed);
      if (!result.success) {
        this.logger.warn(
          `modifier fallback: schema parse failed model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} error=${result.error.message}`,
        );
        return { ...this.passthrough(input, 'invalid_json'), latencyMs };
      }

      const data = result.data;
      const wasModified = data.modify === true && typeof data.modified_message === 'string';

      return {
        deliveredText: wasModified ? (data.modified_message as string) : input.currentMessage,
        wasModified,
        strategy: (data.strategy ?? null) as ModifierStrategy | null,
        reasoning: data.reasoning ?? null,
        confidence: data.confidence_will_fool ?? null,
        latencyMs,
        inputTokens: response.usage?.prompt_tokens ?? null,
        outputTokens: response.usage?.completion_tokens ?? null,
        fallback: false,
      };
    } catch (err) {
      const latencyMs = Date.now() - t0;

      if (err instanceof OpenRouterTimeoutError) {
        this.logger.warn(
          `modifier fallback: timeout model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} msg=${err.message}`,
        );
        return { ...this.passthrough(input, 'timeout'), latencyMs };
      }
      if (err instanceof OpenRouterRateLimitedError) {
        this.logger.warn(
          `modifier fallback: rate_limited model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} msg=${err.message}`,
        );
        return { ...this.passthrough(input, 'rate_limited'), latencyMs };
      }
      if (err instanceof OpenRouterHttpError) {
        this.logger.warn(
          `modifier fallback: http_error status=${err.status} model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} msg=${err.message}`,
        );
        return { ...this.passthrough(input, 'http_error'), latencyMs };
      }
      if (err instanceof OpenRouterNetworkError) {
        this.logger.warn(
          `modifier fallback: network model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} msg=${err.message}`,
        );
        return { ...this.passthrough(input, 'network'), latencyMs };
      }

      // Unknown error — still fall back, never throw
      this.logger.warn(
        `modifier fallback: unknown error model=${input.model} promptId=${input.promptId} turn=${input.currentTurnNumber} err=${String(err)}`,
      );
      return { ...this.passthrough(input, 'http_error'), latencyMs };
    }
  }

  private passthrough(
    input: ModifierInput,
    fallbackReason: ModifierDecision['fallbackReason'],
  ): ModifierDecision {
    return {
      deliveredText: input.currentMessage,
      wasModified: false,
      strategy: null,
      reasoning: null,
      confidence: null,
      latencyMs: 0,
      inputTokens: null,
      outputTokens: null,
      fallback: true,
      fallbackReason,
    };
  }

  private buildUserMessage(input: ModifierInput): string {
    const transcript = this.truncateTranscript(input.transcript);
    const transcriptLines = transcript
      .map((e) => `${e.nickname}: ${e.text}`)
      .join('\n');

    const prevTurns = input.currentTurnNumber - 1;
    return [
      `Topic: ${input.topic}`,
      `Turn ${input.currentTurnNumber} of ${input.totalTurns * 2}`,
      `Modifications so far: ${input.modificationsSoFar}/${prevTurns}`,
      'Transcript:',
      transcriptLines,
      `Current message from ${input.currentPlayerNickname}: ${input.currentMessage}`,
      'Decide.',
    ].join('\n');
  }

  private truncateTranscript(
    transcript: ModifierInput['transcript'],
  ): ModifierInput['transcript'] {
    const totalChars = transcript.reduce((sum, e) => sum + e.text.length, 0);
    if (totalChars <= TRANSCRIPT_CHAR_LIMIT) return transcript;

    if (transcript.length <= TRANSCRIPT_TAIL_KEEP + 1) return transcript;

    const first = transcript[0]!;
    const tail = transcript.slice(-TRANSCRIPT_TAIL_KEEP);
    const middleCount = transcript.length - 1 - TRANSCRIPT_TAIL_KEEP;

    const summary: ModifierInput['transcript'][number] = {
      playerId: '',
      nickname: '[system]',
      text: `[...${middleCount} earlier messages omitted]`,
      turnNumber: first.turnNumber + 1,
    };

    return [first, summary, ...tail];
  }
}
