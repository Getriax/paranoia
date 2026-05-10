import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import {
  ClientEvents,
  ServerEvents,
  lobbyCreatedSchema,
  lobbyJoinedSchema,
  lobbyPlayerJoinedSchema,
  gameStartedSchema,
  gameMessageReceivedSchema,
  gameYourTurnSchema,
  gameVotingPhaseSchema,
  gameOpponentVotingSchema,
  gameResultsSchema,
  surveySubmittedSchema,
  gameOpponentDisconnectedSchema,
  gameOpponentReconnectedSchema,
  errorSchema,
  type LobbyCreatePayload,
  type LobbyJoinPayload,
  type GameMessagePayload,
  type VoteSubmitPayload,
  type SurveySubmitPayload,
  type LobbyCreatedPayload,
  type LobbyJoinedPayload,
  type LobbyPlayerJoinedPayload,
  type GameStartedPayload,
  type GameMessageReceivedPayload,
  type GameYourTurnPayload,
  type GameVotingPhasePayload,
  type GameOpponentVotingPayload,
  type GameResultsPayload,
  type SurveySubmittedPayload,
  type GameOpponentDisconnectedPayload,
  type GameOpponentReconnectedPayload,
  type ErrorPayload,
} from '@openclaw/shared';
// zod is the v3 instance re-exported from @openclaw/shared dist; we only need the safe-parse method
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ZodAnySchema = { safeParse(data: unknown): { success: boolean; data?: unknown; error?: { issues: unknown[] } } };

export type SocketStatus = 'connecting' | 'connected' | 'reconnecting' | 'error';

export interface ClientEventMap {
  [ClientEvents.LOBBY_CREATE]: LobbyCreatePayload;
  [ClientEvents.LOBBY_JOIN]: LobbyJoinPayload;
  [ClientEvents.GAME_MESSAGE]: GameMessagePayload;
  [ClientEvents.VOTE_SUBMIT]: VoteSubmitPayload;
  [ClientEvents.SURVEY_SUBMIT]: SurveySubmitPayload;
}

export interface ServerEventMap {
  [ServerEvents.LOBBY_CREATED]: LobbyCreatedPayload;
  [ServerEvents.LOBBY_JOINED]: LobbyJoinedPayload;
  [ServerEvents.LOBBY_PLAYER_JOINED]: LobbyPlayerJoinedPayload;
  [ServerEvents.GAME_STARTED]: GameStartedPayload;
  [ServerEvents.GAME_MESSAGE_RECEIVED]: GameMessageReceivedPayload;
  [ServerEvents.GAME_YOUR_TURN]: GameYourTurnPayload;
  [ServerEvents.GAME_VOTING_PHASE]: GameVotingPhasePayload;
  [ServerEvents.GAME_OPPONENT_VOTING]: GameOpponentVotingPayload;
  [ServerEvents.GAME_RESULTS]: GameResultsPayload;
  [ServerEvents.SURVEY_SUBMITTED]: SurveySubmittedPayload;
  [ServerEvents.GAME_OPPONENT_DISCONNECTED]: GameOpponentDisconnectedPayload;
  [ServerEvents.GAME_OPPONENT_RECONNECTED]: GameOpponentReconnectedPayload;
  [ServerEvents.ERROR]: ErrorPayload;
}

const serverSchemas: { [K in keyof ServerEventMap]: ZodAnySchema } = {
  [ServerEvents.LOBBY_CREATED]: lobbyCreatedSchema,
  [ServerEvents.LOBBY_JOINED]: lobbyJoinedSchema,
  [ServerEvents.LOBBY_PLAYER_JOINED]: lobbyPlayerJoinedSchema,
  [ServerEvents.GAME_STARTED]: gameStartedSchema,
  [ServerEvents.GAME_MESSAGE_RECEIVED]: gameMessageReceivedSchema,
  [ServerEvents.GAME_YOUR_TURN]: gameYourTurnSchema,
  [ServerEvents.GAME_VOTING_PHASE]: gameVotingPhaseSchema,
  [ServerEvents.GAME_OPPONENT_VOTING]: gameOpponentVotingSchema,
  [ServerEvents.GAME_RESULTS]: gameResultsSchema,
  [ServerEvents.SURVEY_SUBMITTED]: surveySubmittedSchema,
  [ServerEvents.GAME_OPPONENT_DISCONNECTED]: gameOpponentDisconnectedSchema,
  [ServerEvents.GAME_OPPONENT_RECONNECTED]: gameOpponentReconnectedSchema,
  [ServerEvents.ERROR]: errorSchema,
};

export interface UseGameSocketReturn {
  socket: Socket | null;
  status: SocketStatus;
  emit: <E extends keyof ClientEventMap & string>(event: E, payload: ClientEventMap[E]) => void;
  on: <E extends keyof ServerEventMap & string>(event: E, handler: (payload: ServerEventMap[E]) => void) => () => void;
}

export function useGameSocket(sessionToken?: string): UseGameSocketReturn {
  const [status, setStatus] = useState<SocketStatus>('connecting');
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    const wsUrl = (import.meta.env['VITE_WS_URL'] as string | undefined) ?? '/';

    const socket = io(wsUrl, {
      auth: { sessionToken },
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socketRef.current = socket;
    setStatus('connecting');

    socket.on('connect', () => setStatus('connected'));
    socket.on('disconnect', () => setStatus('reconnecting'));
    socket.on('connect_error', () => setStatus('error'));
    socket.io.on('reconnect_attempt', () => setStatus('reconnecting'));
    socket.io.on('reconnect', () => setStatus('connected'));

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [sessionToken]);

  const emit = useCallback(<E extends keyof ClientEventMap & string>(
    event: E,
    payload: ClientEventMap[E],
  ) => {
    socketRef.current?.emit(event, payload);
  }, []);

  const on = useCallback(<E extends keyof ServerEventMap & string>(
    event: E,
    handler: (payload: ServerEventMap[E]) => void,
  ): (() => void) => {
    const socket = socketRef.current;
    if (!socket) return () => undefined;

    const schema = serverSchemas[event];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const wrapped = (raw: unknown): void => {
      const result = schema.safeParse(raw);
      if (!result.success) {
        console.warn(`[useGameSocket] schema mismatch on "${event}":`, result.error?.issues);
        return;
      }
      handler(result.data as ServerEventMap[E]);
    };

    // Use untyped socket interface for dynamic event registration
    const rawSocket = socket as unknown as {
      on(ev: string, fn: (...args: unknown[]) => void): void;
      off(ev: string, fn: (...args: unknown[]) => void): void;
    };
    rawSocket.on(event, wrapped);
    return () => {
      rawSocket.off(event, wrapped);
    };
  }, []);

  return { socket: socketRef.current, status, emit, on };
}
