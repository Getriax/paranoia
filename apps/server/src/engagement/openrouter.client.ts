// TODO: replace with shared client from modifier/openrouter.client.ts once that module lands

import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export type OpenRouterMessage = {
  role: 'system' | 'user' | 'assistant';
  content: string;
};

export type OpenRouterRequest = {
  model: string;
  messages: OpenRouterMessage[];
  response_format?: { type: 'json_object' | 'text' };
  max_tokens?: number;
  temperature?: number;
};

export type OpenRouterResponse = {
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
  };
  model: string;
};

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get<string>('OPENROUTER_API_KEY', '');
    this.baseUrl = this.config.get<string>(
      'OPENROUTER_BASE_URL',
      'https://openrouter.ai/api/v1',
    );
  }

  async complete(
    request: OpenRouterRequest,
    timeoutMs = 8000,
  ): Promise<OpenRouterResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://paranoia.game',
          'X-Title': 'Paranoia',
        },
        body: JSON.stringify(request),
        signal: controller.signal,
      });

      if (!res.ok) {
        throw new Error(`OpenRouter HTTP ${res.status}: ${await res.text()}`);
      }

      return (await res.json()) as OpenRouterResponse;
    } finally {
      clearTimeout(timer);
    }
  }
}
