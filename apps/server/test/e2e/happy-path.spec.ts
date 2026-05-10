import { describe, it, expect } from 'vitest';
import { io, type Socket } from 'socket.io-client';
import {
  ClientEvents,
  ServerEvents,
  type LobbyCreatedPayload,
  type LobbyJoinedPayload,
  type GameStartedPayload,
  type GameYourTurnPayload,
  type GameVotingPhasePayload,
  type GameResultsPayload,
} from '@openclaw/shared';

const RUN = process.env['RUN_E2E'] === '1';
const URL = process.env['E2E_WS_URL'] ?? 'http://localhost:3000';
const TURNS = 4;

function once<T>(socket: Socket, event: string, timeoutMs = 30000): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const handler = (payload: T) => {
      clearTimeout(timer);
      resolve(payload);
    };
    const timer = setTimeout(() => {
      socket.off(event, handler as never);
      reject(new Error(`timeout waiting for "${event}"`));
    }, timeoutMs);
    socket.once(event, handler as never);
  });
}

interface Queue<T> {
  next(timeoutMs?: number): Promise<T>;
  cancel(): void;
}

function queue<T>(socket: Socket, event: string): Queue<T> {
  const buffered: T[] = [];
  const waiters: { resolve: (v: T) => void; reject: (e: Error) => void; done: boolean; timer: ReturnType<typeof setTimeout> | null }[] = [];

  socket.on(event, (payload: T) => {
    while (waiters.length > 0) {
      const w = waiters.shift()!;
      if (!w.done) {
        w.done = true;
        if (w.timer) clearTimeout(w.timer);
        w.resolve(payload);
        return;
      }
    }
    buffered.push(payload);
  });

  return {
    next(timeoutMs = 30000): Promise<T> {
      if (buffered.length > 0) return Promise.resolve(buffered.shift()!);
      return new Promise<T>((resolve, reject) => {
        const w = {
          resolve,
          reject,
          done: false,
          timer: null as ReturnType<typeof setTimeout> | null,
        };
        w.timer = setTimeout(() => {
          if (!w.done) {
            w.done = true;
            reject(new Error(`timeout waiting for "${event}"`));
          }
        }, timeoutMs);
        waiters.push(w);
      });
    },
    cancel(): void {
      for (const w of waiters) {
        w.done = true;
        if (w.timer) clearTimeout(w.timer);
      }
      waiters.length = 0;
    },
  };
}

function waitConnect(socket: Socket): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('connect timeout')), 5000);
    socket.once('connect', () => {
      clearTimeout(timer);
      resolve();
    });
    socket.once('connect_error', (err) => {
      clearTimeout(timer);
      reject(err instanceof Error ? err : new Error(String(err)));
    });
  });
}

describe.skipIf(!RUN)('e2e happy path', () => {
  it(
    `completes a full ${TURNS}-turn game and emits GAME_RESULTS`,
    async () => {
      const a: Socket = io(URL, { transports: ['websocket'] });
      const b: Socket = io(URL, { transports: ['websocket'] });

      try {
        await Promise.all([waitConnect(a), waitConnect(b)]);

        const aTurn = queue<GameYourTurnPayload>(a, ServerEvents.GAME_YOUR_TURN);
        const bTurn = queue<GameYourTurnPayload>(b, ServerEvents.GAME_YOUR_TURN);
        const aVoting = queue<GameVotingPhasePayload>(a, ServerEvents.GAME_VOTING_PHASE);
        const bVoting = queue<GameVotingPhasePayload>(b, ServerEvents.GAME_VOTING_PHASE);
        const aResults = queue<GameResultsPayload>(a, ServerEvents.GAME_RESULTS);
        const bResults = queue<GameResultsPayload>(b, ServerEvents.GAME_RESULTS);
        const aStarted = queue<GameStartedPayload>(a, ServerEvents.GAME_STARTED);
        const bStarted = queue<GameStartedPayload>(b, ServerEvents.GAME_STARTED);

        // Host creates lobby
        const createdP = once<LobbyCreatedPayload>(a, ServerEvents.LOBBY_CREATED);
        a.emit(ClientEvents.LOBBY_CREATE, {
          nickname: 'Alice',
          settings: { turns: TURNS, category: 'relationships' },
        });
        const created = await createdP;
        expect(created.roomCode).toMatch(/^[A-HJ-NP-Z2-9]{6}$/);
        const aId = created.playerId;

        // Joiner joins
        const joinedP = once<LobbyJoinedPayload>(b, ServerEvents.LOBBY_JOINED);
        b.emit(ClientEvents.LOBBY_JOIN, {
          nickname: 'Bob',
          roomCode: created.roomCode,
        });
        const joined = await joinedP;
        const bId = joined.playerId;

        const [startA, startB] = await Promise.all([aStarted.next(), bStarted.next()]);
        expect(startA.totalTurns).toBe(TURNS);
        expect(startB.totalTurns).toBe(TURNS);
        expect([aId, bId]).toContain(startA.firstPlayerId);

        // Drive 2*TURNS turns by following game:your_turn signals
        const sockets: Record<string, Socket> = { [aId]: a, [bId]: b };
        for (let n = 0; n < TURNS * 2; n += 1) {
          // Whichever player gets the turn emits next
          const turn = await Promise.race([aTurn.next(), bTurn.next()]);
          aTurn.cancel();
          bTurn.cancel();
          const turnNumber = turn.turnNumber;
          // The host plays odd turns (1, 3, ...) and B plays even, but
          // server tells us via your_turn — pick the socket that should send.
          const sock = turnNumber % 2 === 1 ? sockets[startA.firstPlayerId]! : sockets[startA.firstPlayerId === aId ? bId : aId]!;
          sock.emit(ClientEvents.GAME_MESSAGE, { text: `turn ${turnNumber} thoughts` });
        }

        const [vA, vB] = await Promise.all([aVoting.next(), bVoting.next()]);
        expect(vA.messages.length).toBe(TURNS * 2);
        expect(vB.messages.length).toBe(TURNS * 2);

        const aVotes = vA.messages
          .filter((m) => m.fromPlayerId !== aId)
          .map((m) => ({ messageId: m.id, guessedModified: false }));
        const bVotes = vB.messages
          .filter((m) => m.fromPlayerId !== bId)
          .map((m) => ({ messageId: m.id, guessedModified: false }));

        expect(aVotes.length).toBe(TURNS);
        expect(bVotes.length).toBe(TURNS);

        a.emit(ClientEvents.VOTE_SUBMIT, { votes: aVotes });
        b.emit(ClientEvents.VOTE_SUBMIT, { votes: bVotes });

        const [rA, rB] = await Promise.all([aResults.next(), bResults.next()]);
        expect(rA.messages.length).toBe(TURNS * 2);
        expect(rB.messages.length).toBe(TURNS * 2);
        expect(typeof rA.score).toBe('number');
        expect(typeof rB.score).toBe('number');
      } finally {
        a.disconnect();
        b.disconnect();
      }
    },
    120000,
  );
});
