export type GameStatus =
  | 'lobby'
  | 'playing'
  | 'voting'
  | 'finished'
  | 'abandoned';

const TRANSITIONS: Record<GameStatus, ReadonlyArray<GameStatus>> = {
  lobby: ['playing', 'abandoned'],
  playing: ['voting', 'abandoned'],
  voting: ['finished', 'abandoned'],
  finished: [],
  abandoned: [],
};

export function canTransition(from: GameStatus, to: GameStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: GameStatus, to: GameStatus): void {
  if (!canTransition(from, to)) {
    throw new Error(`Invalid transition: ${from} → ${to}`);
  }
}
