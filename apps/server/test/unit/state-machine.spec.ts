import { describe, it, expect } from 'vitest';
import {
  canTransition,
  assertTransition,
  type GameStatus,
} from '../../src/game/state.js';

const ALL: GameStatus[] = [
  'lobby',
  'playing',
  'voting',
  'finished',
  'abandoned',
];

describe('canTransition', () => {
  it('allows lobby → playing', () => {
    expect(canTransition('lobby', 'playing')).toBe(true);
  });

  it('allows playing → voting', () => {
    expect(canTransition('playing', 'voting')).toBe(true);
  });

  it('allows voting → finished', () => {
    expect(canTransition('voting', 'finished')).toBe(true);
  });

  it('allows abandonment from any active state', () => {
    expect(canTransition('lobby', 'abandoned')).toBe(true);
    expect(canTransition('playing', 'abandoned')).toBe(true);
    expect(canTransition('voting', 'abandoned')).toBe(true);
  });

  it('forbids skipping phases', () => {
    expect(canTransition('lobby', 'voting')).toBe(false);
    expect(canTransition('lobby', 'finished')).toBe(false);
    expect(canTransition('playing', 'finished')).toBe(false);
  });

  it('treats finished and abandoned as terminal', () => {
    for (const target of ALL) {
      expect(canTransition('finished', target)).toBe(false);
      expect(canTransition('abandoned', target)).toBe(false);
    }
  });

  it('forbids backward transitions', () => {
    expect(canTransition('voting', 'playing')).toBe(false);
    expect(canTransition('playing', 'lobby')).toBe(false);
    expect(canTransition('voting', 'lobby')).toBe(false);
  });

  it('forbids self-loops', () => {
    for (const s of ALL) {
      expect(canTransition(s, s)).toBe(false);
    }
  });
});

describe('assertTransition', () => {
  it('passes for valid transitions', () => {
    expect(() => assertTransition('lobby', 'playing')).not.toThrow();
  });

  it('throws for invalid transitions', () => {
    expect(() => assertTransition('finished', 'playing')).toThrowError(
      /Invalid transition/,
    );
  });
});
