import { Injectable, Logger } from '@nestjs/common';

export interface OpenRouterMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface OpenRouterRequestParams {
  model: string;
  messages: OpenRouterMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: 'json_object' | 'text' };
}

export interface OpenRouterUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens?: number;
}

export interface OpenRouterResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
  usage?: OpenRouterUsage;
}

export class OpenRouterTimeoutError extends Error {
  readonly type = 'timeout' as const;
  constructor() {
    super('OpenRouter request timed out');
    this.name = 'OpenRouterTimeoutError';
  }
}

export class OpenRouterNetworkError extends Error {
  readonly type = 'network' as const;
  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause));
    this.name = 'OpenRouterNetworkError';
  }
}

export class OpenRouterRateLimitedError extends Error {
  readonly type = 'rate_limited' as const;
  constructor() {
    super('OpenRouter rate limited (429)');
    this.name = 'OpenRouterRateLimitedError';
  }
}

export class OpenRouterHttpError extends Error {
  readonly type = 'http_error' as const;
  constructor(readonly status: number) {
    super(`OpenRouter HTTP error: ${status}`);
    this.name = 'OpenRouterHttpError';
  }
}

const DEFAULT_TIMEOUT_MS = 8000;

@Injectable()
export class OpenRouterClient {
  private readonly logger = new Logger(OpenRouterClient.name);
  private readonly apiKey: string;
  private readonly baseUrl: string;
  private readonly timeoutMs: number = DEFAULT_TIMEOUT_MS;
  readonly enabled: boolean;

  constructor() {
    const provider = process.env.MODIFIER_PROVIDER;
    this.enabled = provider !== 'mock';

    const apiKey = process.env.OPENROUTER_API_KEY;
    if (this.enabled && !apiKey) {
      throw new Error(
        'OPENROUTER_API_KEY is required when MODIFIER_PROVIDER !== "mock"',
      );
    }
    this.apiKey = apiKey ?? '';
    this.baseUrl =
      process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1';
  }

  async complete(params: OpenRouterRequestParams): Promise<OpenRouterResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);

    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.apiKey}`,
          'HTTP-Referer': 'https://paranoia.krulestwo.com',
          'X-Title': 'Paranoia',
        },
        body: JSON.stringify(params),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      if (err instanceof Error && err.name === 'AbortError') {
        throw new OpenRouterTimeoutError();
      }
      throw new OpenRouterNetworkError(err);
    } finally {
      clearTimeout(timer);
    }

    if (!res.ok) {
      if (res.status === 429) throw new OpenRouterRateLimitedError();
      throw new OpenRouterHttpError(res.status);
    }

    const data = (await res.json()) as OpenRouterResponse;
    return data;
  }

  parseContent(content: string): unknown {
    return JSON.parse(content);
  }
}
