import { describe, it, expect } from 'vitest';

const DECEPTION_WEIGHT = 0.6;
const ENGAGEMENT_WEIGHT = 0.4;
const ENGAGEMENT_PLACEHOLDER = 0.5;

interface Msg {
  id: string;
  playerId: string;
  wasModified: boolean;
}
interface Vote {
  voterPlayerId: string;
  messageId: string;
  guess: boolean;
}

function score(playerId: string, opponentId: string, msgs: Msg[], votes: Vote[]): number {
  const myMsgs = msgs.filter((m) => m.playerId === playerId);
  if (myMsgs.length === 0) return Math.round(ENGAGEMENT_WEIGHT * ENGAGEMENT_PLACEHOLDER * 1000) / 1000;
  const oppVotes = votes.filter(
    (v) => v.voterPlayerId === opponentId && myMsgs.some((m) => m.id === v.messageId),
  );
  const wrong = oppVotes.filter((v) => {
    const m = myMsgs.find((x) => x.id === v.messageId);
    return m && v.guess !== m.wasModified;
  }).length;
  const deception = wrong / myMsgs.length;
  const composite =
    DECEPTION_WEIGHT * deception + ENGAGEMENT_WEIGHT * ENGAGEMENT_PLACEHOLDER;
  return Math.round(composite * 1000) / 1000;
}

describe('voting score formula', () => {
  it('returns 0.2 when opponent guesses everything correctly', () => {
    const msgs: Msg[] = [
      { id: 'm1', playerId: 'A', wasModified: true },
      { id: 'm2', playerId: 'A', wasModified: false },
    ];
    const votes: Vote[] = [
      { voterPlayerId: 'B', messageId: 'm1', guess: true },
      { voterPlayerId: 'B', messageId: 'm2', guess: false },
    ];
    expect(score('A', 'B', msgs, votes)).toBe(0.2);
  });

  it('returns 0.8 when opponent gets everything wrong', () => {
    const msgs: Msg[] = [
      { id: 'm1', playerId: 'A', wasModified: true },
      { id: 'm2', playerId: 'A', wasModified: false },
    ];
    const votes: Vote[] = [
      { voterPlayerId: 'B', messageId: 'm1', guess: false },
      { voterPlayerId: 'B', messageId: 'm2', guess: true },
    ];
    expect(score('A', 'B', msgs, votes)).toBe(0.8);
  });

  it('returns 0.5 for half wrong (1/2)', () => {
    const msgs: Msg[] = [
      { id: 'm1', playerId: 'A', wasModified: true },
      { id: 'm2', playerId: 'A', wasModified: false },
    ];
    const votes: Vote[] = [
      { voterPlayerId: 'B', messageId: 'm1', guess: true },
      { voterPlayerId: 'B', messageId: 'm2', guess: true },
    ];
    expect(score('A', 'B', msgs, votes)).toBe(0.5);
  });

  it('rounds to 3 decimals (1/3 wrong → 0.4)', () => {
    const msgs: Msg[] = [
      { id: 'm1', playerId: 'A', wasModified: true },
      { id: 'm2', playerId: 'A', wasModified: false },
      { id: 'm3', playerId: 'A', wasModified: true },
    ];
    const votes: Vote[] = [
      { voterPlayerId: 'B', messageId: 'm1', guess: true },
      { voterPlayerId: 'B', messageId: 'm2', guess: false },
      { voterPlayerId: 'B', messageId: 'm3', guess: false },
    ];
    // 1/3 ≈ 0.333... → 0.6 * 0.333 + 0.2 = 0.4
    expect(score('A', 'B', msgs, votes)).toBe(0.4);
  });

  it('ignores votes from non-opponent players', () => {
    const msgs: Msg[] = [{ id: 'm1', playerId: 'A', wasModified: true }];
    const votes: Vote[] = [
      { voterPlayerId: 'C', messageId: 'm1', guess: false },
    ];
    expect(score('A', 'B', msgs, votes)).toBe(0.2);
  });

  it('ignores votes on opponent\'s own messages (no own-message votes)', () => {
    const msgs: Msg[] = [
      { id: 'm1', playerId: 'A', wasModified: true },
      { id: 'm2', playerId: 'B', wasModified: true },
    ];
    const votes: Vote[] = [
      { voterPlayerId: 'B', messageId: 'm1', guess: true },
    ];
    expect(score('A', 'B', msgs, votes)).toBe(0.2);
  });

  it('handles edge case of a player with zero messages (engagement placeholder only)', () => {
    expect(score('A', 'B', [], [])).toBe(0.2);
  });
});
