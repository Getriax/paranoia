import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { eq } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  game,
  message,
  player,
  topic,
  engagementSurvey,
  engagementAnalysis,
} from '../db/schema.js';
import { OpenRouterClient } from './openrouter.client.js';
import { engagementAnalysisSchema } from './engagement.types.js';

const SYSTEM_PROMPT = `You are an engagement analyst for a two-player conversation game called Paranoia.
You will be given a conversation transcript and optional player survey responses.
Your task is to evaluate the quality and engagement of the conversation.

Score the conversation on the following dimensions (each 0.0–1.0):
- depth: How substantive and thoughtful the conversation was
- callbacks: How much players built on prior statements
- novelty: How fresh and interesting the ideas exchanged were
- coherence: How logically connected the conversation flow was

Compute an overall score (0.0–1.0) as a weighted average: depth*0.3 + callbacks*0.25 + novelty*0.25 + coherence*0.2

Respond ONLY with valid JSON matching this exact schema:
{
  "score": <number 0-1>,
  "dimensions": {
    "depth": <number 0-1>,
    "callbacks": <number 0-1>,
    "novelty": <number 0-1>,
    "coherence": <number 0-1>
  },
  "reasoning": "<brief explanation of your assessment>"
}`;

@Injectable()
export class EngagementWorker {
  private readonly logger = new Logger(EngagementWorker.name);

  constructor(
    private readonly openRouter: OpenRouterClient,
    private readonly config: ConfigService,
  ) {}

  async run(gameId: string): Promise<void> {
    const [existing] = await db
      .select({ id: engagementAnalysis.id })
      .from(engagementAnalysis)
      .where(eq(engagementAnalysis.gameId, gameId))
      .limit(1);

    if (existing) {
      this.logger.debug(
        `engagement.worker: analysis already exists for gameId=${gameId}, skipping`,
      );
      return;
    }

    const [gameRow] = await db
      .select()
      .from(game)
      .where(eq(game.id, gameId))
      .limit(1);

    if (!gameRow) {
      this.logger.warn(`engagement.worker: game not found gameId=${gameId}`);
      return;
    }

    const [topicRow] = gameRow.topicId
      ? await db
          .select()
          .from(topic)
          .where(eq(topic.id, gameRow.topicId))
          .limit(1)
      : [undefined];

    const players = await db
      .select()
      .from(player)
      .where(eq(player.gameId, gameId));

    const playerMap = new Map(players.map((p) => [p.id, p.displayName]));

    const messages = await db
      .select()
      .from(message)
      .where(eq(message.gameId, gameId))
      .orderBy(message.turnNumber);

    const surveys = await db
      .select()
      .from(engagementSurvey)
      .where(eq(engagementSurvey.gameId, gameId));

    const transcriptLines = messages.map((m) => {
      const nickname = playerMap.get(m.playerId) ?? 'unknown';
      return `[Turn ${m.turnNumber}] ${nickname}: ${m.deliveredText}`;
    });

    const surveyLines = surveys.map((s) => {
      const nickname = playerMap.get(s.playerId) ?? 'unknown';
      const parts = [
        `${nickname}: rating=${s.rating}/5`,
        `wouldReplay=${s.wouldReplay}`,
      ];
      if (s.comment) parts.push(`comment="${s.comment}"`);
      return parts.join(', ');
    });

    const topicLine = `Topic: ${topicRow?.text ?? '(unknown)'}`;

    const userPrompt = [
      topicLine,
      '',
      'Transcript:',
      ...transcriptLines,
      '',
      surveyLines.length > 0
        ? ['Survey responses:', ...surveyLines].join('\n')
        : 'Survey responses: none',
    ].join('\n');

    const model =
      this.config.get<string>('ENGAGEMENT_MODEL') ??
      this.config.get<string>('MODIFIER_DEFAULT_MODEL') ??
      'deepseek/deepseek-v4-flash';

    let result;
    try {
      const response = await this.openRouter.complete(
        {
          model,
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          response_format: { type: 'json_object' },
          max_tokens: 1024,
          temperature: 0.4,
        },
        8000,
      );

      const raw = response.choices[0]?.message?.content ?? '';
      const parsed = JSON.parse(raw) as unknown;
      result = engagementAnalysisSchema.parse(parsed);
    } catch (err) {
      this.logger.warn(
        `engagement.worker: analysis failed for gameId=${gameId}: ${String(err)}`,
      );
      return;
    }

    await db
      .insert(engagementAnalysis)
      .values({
        gameId,
        score: String(result.score),
        dimensions: result.dimensions,
        reasoning: result.reasoning,
        model,
        promptId: null,
        computedAt: new Date(),
      })
      .onConflictDoNothing();

    this.logger.log(
      `engagement.analysis: gameId=${gameId} score=${result.score}`,
    );
  }
}
