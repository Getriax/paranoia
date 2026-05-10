import { Injectable } from '@nestjs/common';
import { db } from '../db/client.js';
import { dragonfly } from '../db/dragonfly.js';
import { player, game } from '../db/schema.js';
import { eq } from 'drizzle-orm';

@Injectable()
export class SessionService {
  async resolveSession(sessionToken: string): Promise<{
    player: typeof player.$inferSelect;
    game: typeof game.$inferSelect;
  } | null> {
    const cached = await dragonfly.get(`session:${sessionToken}`);
    if (cached) {
      const { playerId, gameId } = JSON.parse(cached) as {
        playerId: string;
        gameId: string;
      };
      const [playerRow] = await db
        .select()
        .from(player)
        .where(eq(player.id, playerId))
        .limit(1);
      const [gameRow] = await db
        .select()
        .from(game)
        .where(eq(game.id, gameId))
        .limit(1);
      if (playerRow && gameRow) {
        return { player: playerRow, game: gameRow };
      }
      return null;
    }

    const [playerRow] = await db
      .select()
      .from(player)
      .where(eq(player.sessionToken, sessionToken))
      .limit(1);

    if (!playerRow) return null;

    const [gameRow] = await db
      .select()
      .from(game)
      .where(eq(game.id, playerRow.gameId))
      .limit(1);

    if (!gameRow) return null;

    await dragonfly.set(
      `session:${sessionToken}`,
      JSON.stringify({ playerId: playerRow.id, gameId: gameRow.id }),
      'EX',
      60,
    );

    return { player: playerRow, game: gameRow };
  }

  async cacheSession(
    sessionToken: string,
    playerId: string,
    gameId: string,
  ): Promise<void> {
    await dragonfly.set(
      `session:${sessionToken}`,
      JSON.stringify({ playerId, gameId }),
      'EX',
      60,
    );
  }
}
