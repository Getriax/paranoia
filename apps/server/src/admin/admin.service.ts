import { Injectable } from '@nestjs/common';
import { inArray, gte, lte, and, type SQL } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  game,
  player,
  message,
  vote,
  engagementSurvey,
  engagementAnalysis,
  topic,
  prompt,
} from '../db/schema.js';

export type IncludeKey =
  | 'messages'
  | 'votes'
  | 'surveys'
  | 'analyses'
  | 'topic'
  | 'prompt'
  | 'players';

export const ALL_INCLUDE: IncludeKey[] = [
  'messages',
  'votes',
  'surveys',
  'analyses',
  'topic',
  'prompt',
  'players',
];

export interface ExportFilters {
  from?: Date;
  to?: Date;
  limit: number;
}

@Injectable()
export class AdminService {
  async *streamGames(
    filters: ExportFilters,
    include: Set<IncludeKey>,
  ): AsyncIterable<string> {
    const conditions: SQL[] = [];
    if (filters.from) conditions.push(gte(game.createdAt, filters.from));
    if (filters.to) conditions.push(lte(game.createdAt, filters.to));

    const games = await db
      .select({
        id: game.id,
        roomCode: game.roomCode,
        status: game.status,
        totalTurns: game.totalTurns,
        model: game.model,
        promptId: game.promptId,
        topicId: game.topicId,
        createdAt: game.createdAt,
        updatedAt: game.updatedAt,
      })
      .from(game)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(game.createdAt)
      .limit(filters.limit);

    if (games.length === 0) return;

    const gameIds = games.map((g) => g.id);

    const topicIds = games
      .map((g) => g.topicId)
      .filter((id): id is string => id !== null);
    const promptIds = games
      .map((g) => g.promptId)
      .filter((id): id is string => id !== null);

    // Bulk fetch all related records in parallel; skip queries for unneeded relations
    const [topicRows, promptRows, playerRows, messageRows, surveyRows, analysisRows] =
      await Promise.all([
        include.has('topic') && topicIds.length > 0
          ? db
              .select({
                id: topic.id,
                text: topic.text,
                category: topic.category,
                difficulty: topic.difficulty,
              })
              .from(topic)
              .where(inArray(topic.id, topicIds))
          : Promise.resolve([]),

        include.has('prompt') && promptIds.length > 0
          ? db
              .select({
                id: prompt.id,
                name: prompt.name,
                version: prompt.version,
                systemPrompt: prompt.systemPrompt,
              })
              .from(prompt)
              .where(inArray(prompt.id, promptIds))
          : Promise.resolve([]),

        include.has('players')
          ? db
              .select({
                id: player.id,
                gameId: player.gameId,
                displayName: player.displayName,
                position: player.position,
                score: player.score,
              })
              .from(player)
              .where(inArray(player.gameId, gameIds))
          : Promise.resolve([]),

        include.has('messages') || include.has('votes')
          ? db
              .select({
                id: message.id,
                gameId: message.gameId,
                playerId: message.playerId,
                turnNumber: message.turnNumber,
                originalText: message.originalText,
                deliveredText: message.deliveredText,
                wasModified: message.wasModified,
                modifierDecision: message.modifierDecision,
                modifierLatencyMs: message.modifierLatencyMs,
                modifierTokensIn: message.modifierTokensIn,
                modifierTokensOut: message.modifierTokensOut,
                createdAt: message.createdAt,
              })
              .from(message)
              .where(inArray(message.gameId, gameIds))
              .orderBy(message.turnNumber)
          : Promise.resolve([]),

        include.has('surveys')
          ? db
              .select({
                id: engagementSurvey.id,
                gameId: engagementSurvey.gameId,
                playerId: engagementSurvey.playerId,
                rating: engagementSurvey.rating,
                wouldReplay: engagementSurvey.wouldReplay,
                comment: engagementSurvey.comment,
                createdAt: engagementSurvey.createdAt,
              })
              .from(engagementSurvey)
              .where(inArray(engagementSurvey.gameId, gameIds))
          : Promise.resolve([]),

        include.has('analyses')
          ? db
              .select({
                id: engagementAnalysis.id,
                gameId: engagementAnalysis.gameId,
                score: engagementAnalysis.score,
                dimensions: engagementAnalysis.dimensions,
                reasoning: engagementAnalysis.reasoning,
                model: engagementAnalysis.model,
                computedAt: engagementAnalysis.computedAt,
              })
              .from(engagementAnalysis)
              .where(inArray(engagementAnalysis.gameId, gameIds))
          : Promise.resolve([]),
      ]);

    // Fetch votes separately — votes join to messages by messageId, not directly to game
    const messageIds = messageRows.map((m) => m.id);
    const voteRows =
      include.has('votes') && messageIds.length > 0
        ? await db
            .select({
              id: vote.id,
              messageId: vote.messageId,
              voterPlayerId: vote.voterPlayerId,
              guess: vote.guess,
              createdAt: vote.createdAt,
            })
            .from(vote)
            .where(inArray(vote.messageId, messageIds))
        : [];

    // Build lookup maps keyed by gameId
    const topicMap = new Map(topicRows.map((t) => [t.id, t]));
    const promptMap = new Map(promptRows.map((p) => [p.id, p]));

    const playersByGame = new Map<string, typeof playerRows>();
    for (const p of playerRows) {
      const list = playersByGame.get(p.gameId) ?? [];
      list.push(p);
      playersByGame.set(p.gameId, list);
    }

    const messagesByGame = new Map<string, typeof messageRows>();
    const messageToGame = new Map<string, string>(); // messageId → gameId
    for (const m of messageRows) {
      const list = messagesByGame.get(m.gameId) ?? [];
      list.push(m);
      messagesByGame.set(m.gameId, list);
      messageToGame.set(m.id, m.gameId);
    }

    const votesByGame = new Map<string, typeof voteRows>();
    for (const v of voteRows) {
      const gid = messageToGame.get(v.messageId);
      if (!gid) continue;
      const list = votesByGame.get(gid) ?? [];
      list.push(v);
      votesByGame.set(gid, list);
    }

    const surveysByGame = new Map<string, typeof surveyRows>();
    for (const s of surveyRows) {
      const list = surveysByGame.get(s.gameId) ?? [];
      list.push(s);
      surveysByGame.set(s.gameId, list);
    }

    const analysisByGame = new Map<string, typeof analysisRows>();
    for (const a of analysisRows) {
      const list = analysisByGame.get(a.gameId) ?? [];
      list.push(a);
      analysisByGame.set(a.gameId, list);
    }

    for (const g of games) {
      const row: Record<string, unknown> = { game: g };

      if (include.has('topic')) {
        row['topic'] = g.topicId ? (topicMap.get(g.topicId) ?? null) : null;
      }
      if (include.has('prompt')) {
        row['prompt'] = g.promptId ? (promptMap.get(g.promptId) ?? null) : null;
      }
      if (include.has('players')) {
        row['players'] = (playersByGame.get(g.id) ?? []).map((p) => ({
          id: p.id,
          displayName: p.displayName,
          position: p.position,
          score: p.score,
        }));
      }
      if (include.has('messages')) {
        row['messages'] = (messagesByGame.get(g.id) ?? []).map((m) => ({
          id: m.id,
          playerId: m.playerId,
          turnNumber: m.turnNumber,
          originalText: m.originalText,
          deliveredText: m.deliveredText,
          wasModified: m.wasModified,
          modifierDecision: m.modifierDecision,
          modifierLatencyMs: m.modifierLatencyMs,
          modifierTokensIn: m.modifierTokensIn,
          modifierTokensOut: m.modifierTokensOut,
          createdAt: m.createdAt,
        }));
      }
      if (include.has('votes')) {
        row['votes'] = votesByGame.get(g.id) ?? [];
      }
      if (include.has('surveys')) {
        row['surveys'] = (surveysByGame.get(g.id) ?? []).map((s) => ({
          id: s.id,
          playerId: s.playerId,
          rating: s.rating,
          wouldReplay: s.wouldReplay,
          comment: s.comment,
          createdAt: s.createdAt,
        }));
      }
      if (include.has('analyses')) {
        row['analyses'] = (analysisByGame.get(g.id) ?? []).map((a) => ({
          id: a.id,
          score: a.score,
          dimensions: a.dimensions,
          reasoning: a.reasoning,
          model: a.model,
          computedAt: a.computedAt,
        }));
      }

      yield JSON.stringify(row) + '\n';
    }
  }
}
