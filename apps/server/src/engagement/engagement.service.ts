import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Server, Socket } from 'socket.io';
import { db } from '../db/client.js';
import { engagementSurvey, game, player } from '../db/schema.js';
import { ServerEvents, type SurveySubmitPayload } from '@openclaw/shared';
import { EngagementWorker } from './engagement.worker.js';

@Injectable()
export class EngagementService {
  private readonly logger = new Logger(EngagementService.name);

  constructor(
    private readonly worker: EngagementWorker,
    private readonly config: ConfigService,
  ) {}

  async submitSurvey(
    _server: Server,
    client: Socket,
    payload: SurveySubmitPayload,
  ): Promise<void> {
    const playerData = client.data?.player as
      | typeof player.$inferSelect
      | undefined;
    const gameData = client.data?.game as typeof game.$inferSelect | undefined;

    if (!playerData || !gameData) {
      client.emit(ServerEvents.ERROR, {
        code: 'UNAUTHORIZED',
        message: 'No active session',
      });
      return;
    }

    const { id: playerId } = playerData;
    const { id: gameId } = gameData;
    const { rating, wouldReplay, comment } = payload;

    const inserted = await db
      .insert(engagementSurvey)
      .values({ gameId, playerId, rating, wouldReplay, comment })
      .onConflictDoNothing()
      .returning({ id: engagementSurvey.id });

    if (inserted.length === 0) {
      client.emit(ServerEvents.ERROR, {
        code: 'SURVEY_ALREADY_SUBMITTED',
        message: 'You have already submitted a survey for this game',
      });
      return;
    }

    this.logger.log(
      `engagement.survey: gameId=${gameId} playerId=${playerId} rating=${rating}`,
    );

    const room = `game:${gameId}`;
    client.emit(ServerEvents.SURVEY_SUBMITTED, { playerId });
    client.to(room).emit(ServerEvents.SURVEY_SUBMITTED, { playerId });
  }

  scheduleAnalysis(gameId: string): void {
    const enabled =
      this.config.get<string>('ENGAGEMENT_ANALYSIS_ENABLED') ?? 'true';
    if (enabled !== 'true') return;

    setImmediate(() => {
      this.worker.run(gameId).catch((err: unknown) => {
        this.logger.error(
          `engagement.worker: unhandled error gameId=${gameId}: ${String(err)}`,
        );
      });
    });
  }
}
