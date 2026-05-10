import { z } from 'zod';

// ── Auth ──
export const handshakeAuthSchema = z.object({
  sessionToken: z.string().optional(),
});
export type HandshakeAuth = z.infer<typeof handshakeAuthSchema>;

// ── Client → Server ──

export const lobbyCreateSchema = z.object({
  nickname: z.string().min(1).max(30),
  settings: z.object({
    turns: z.number().int().min(2).max(20).default(6),
    category: z.string().optional(),
  }),
});
export type LobbyCreatePayload = z.infer<typeof lobbyCreateSchema>;

export const lobbyJoinSchema = z.object({
  roomCode: z.string().length(6),
  nickname: z.string().min(1).max(30),
});
export type LobbyJoinPayload = z.infer<typeof lobbyJoinSchema>;

export const gameMessageSchema = z.object({
  text: z.string().min(1).max(2000),
});
export type GameMessagePayload = z.infer<typeof gameMessageSchema>;

export const voteSubmitSchema = z.object({
  votes: z.array(z.object({
    messageId: z.string().uuid(),
    guessedModified: z.boolean(),
  })).min(1),
});
export type VoteSubmitPayload = z.infer<typeof voteSubmitSchema>;

export const surveySubmitSchema = z.object({
  rating: z.number().int().min(1).max(5),
  wouldReplay: z.boolean(),
  comment: z.string().max(500).optional(),
});
export type SurveySubmitPayload = z.infer<typeof surveySubmitSchema>;

// ── Server → Client ──

export const lobbyCreatedSchema = z.object({
  roomCode: z.string().length(6),
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  sessionToken: z.string().min(1),
});
export type LobbyCreatedPayload = z.infer<typeof lobbyCreatedSchema>;

export const lobbyJoinedSchema = z.object({
  gameId: z.string().uuid(),
  playerId: z.string().uuid(),
  sessionToken: z.string().min(1),
  opponent: z.object({ playerId: z.string().uuid(), nickname: z.string() }).nullable(),
});
export type LobbyJoinedPayload = z.infer<typeof lobbyJoinedSchema>;

export const lobbyPlayerJoinedSchema = z.object({
  players: z.array(z.object({ playerId: z.string().uuid(), nickname: z.string() })),
});
export type LobbyPlayerJoinedPayload = z.infer<typeof lobbyPlayerJoinedSchema>;

export const gameStartedSchema = z.object({
  topic: z.string(),
  totalTurns: z.number().int(),
  firstPlayerId: z.string().uuid(),
});
export type GameStartedPayload = z.infer<typeof gameStartedSchema>;

export const gameMessageReceivedSchema = z.object({
  messageId: z.string().uuid(),
  fromPlayerId: z.string().uuid(),
  text: z.string(),
  turnNumber: z.number().int(),
});
export type GameMessageReceivedPayload = z.infer<typeof gameMessageReceivedSchema>;

export const gameYourTurnSchema = z.object({
  turnNumber: z.number().int(),
  remainingTurns: z.number().int(),
});
export type GameYourTurnPayload = z.infer<typeof gameYourTurnSchema>;

export const gameVotingPhaseSchema = z.object({
  messages: z.array(z.object({
    id: z.string().uuid(),
    text: z.string(),
    fromPlayerId: z.string().uuid(),
    turnNumber: z.number().int(),
  })),
});
export type GameVotingPhasePayload = z.infer<typeof gameVotingPhaseSchema>;

export const gameOpponentVotingSchema = z.object({
  submitted: z.boolean(),
});
export type GameOpponentVotingPayload = z.infer<typeof gameOpponentVotingSchema>;

export const gameResultsSchema = z.object({
  messages: z.array(z.any()),
  votes: z.array(z.any()),
  score: z.number(),
  opponentSurveyPending: z.boolean(),
});
export type GameResultsPayload = z.infer<typeof gameResultsSchema>;

export const surveySubmittedSchema = z.object({
  playerId: z.string().uuid(),
});
export type SurveySubmittedPayload = z.infer<typeof surveySubmittedSchema>;

export const gameOpponentDisconnectedSchema = z.object({
  reconnectDeadline: z.string(),
});
export type GameOpponentDisconnectedPayload = z.infer<typeof gameOpponentDisconnectedSchema>;

export const gameOpponentReconnectedSchema = z.object({});
export type GameOpponentReconnectedPayload = z.infer<typeof gameOpponentReconnectedSchema>;

export const errorSchema = z.object({
  code: z.string(),
  message: z.string(),
});
export type ErrorPayload = z.infer<typeof errorSchema>;

export const ClientEvents = {
  LOBBY_CREATE: 'lobby:create',
  LOBBY_JOIN: 'lobby:join',
  GAME_MESSAGE: 'game:message',
  VOTE_SUBMIT: 'vote:submit',
  SURVEY_SUBMIT: 'survey:submit',
} as const;

export const ServerEvents = {
  LOBBY_CREATED: 'lobby:created',
  LOBBY_JOINED: 'lobby:joined',
  LOBBY_PLAYER_JOINED: 'lobby:player_joined',
  GAME_STARTED: 'game:started',
  GAME_MESSAGE_RECEIVED: 'game:message_received',
  GAME_YOUR_TURN: 'game:your_turn',
  GAME_VOTING_PHASE: 'game:voting_phase',
  GAME_OPPONENT_VOTING: 'game:opponent_voting',
  GAME_RESULTS: 'game:results',
  SURVEY_SUBMITTED: 'survey:submitted',
  GAME_OPPONENT_DISCONNECTED: 'game:opponent_disconnected',
  GAME_OPPONENT_RECONNECTED: 'game:opponent_reconnected',
  ERROR: 'error',
} as const;
