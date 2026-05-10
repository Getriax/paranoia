import {
  WebSocketGateway,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
  MessageBody,
  ConnectedSocket,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger, UseGuards } from '@nestjs/common';
import { SessionService } from './session.service.js';
import { WsAuthGuard } from './ws-auth.guard.js';
import { dragonfly } from '../db/dragonfly.js';
import {
  ClientEvents,
  ServerEvents,
  lobbyCreateSchema,
  lobbyJoinSchema,
  gameMessageSchema,
  voteSubmitSchema,
  surveySubmitSchema,
  handshakeAuthSchema,
} from '@openclaw/shared';

@WebSocketGateway({
  cors: { origin: '*' },
  pingInterval: 25000,
  pingTimeout: 20000,
  connectTimeout: 10000,
})
export class GameGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(GameGateway.name);

  constructor(private readonly sessionService: SessionService) {}

  async handleConnection(client: Socket): Promise<void> {
    const auth = handshakeAuthSchema.safeParse(client.handshake.auth);
    const sessionToken = auth.success ? auth.data.sessionToken : undefined;

    if (!sessionToken) {
      this.logger.log(`Client ${client.id} connected (no session token)`);
      return;
    }

    const session = await this.sessionService.resolveSession(sessionToken);
    if (!session) {
      client.emit(ServerEvents.ERROR, {
        code: 'INVALID_SESSION',
        message: 'Session token is invalid or expired',
      });
      client.disconnect(true);
      return;
    }

    client.data.player = session.player;
    client.data.game = session.game;

    const room = `game:${session.game.id}`;
    await client.join(room);

    if (session.game.status === 'playing') {
      client.to(room).emit(ServerEvents.GAME_OPPONENT_RECONNECTED, {});
    }

    this.logger.log(
      `Client ${client.id} reconnected as player ${session.player.id} in game ${session.game.id}`,
    );
  }

  async handleDisconnect(client: Socket): Promise<void> {
    const playerData = client.data?.player;
    const gameData = client.data?.game;

    if (!playerData || !gameData) return;

    if (gameData.status === 'playing') {
      const reconnectDeadline = new Date(Date.now() + 30_000).toISOString();
      const room = `game:${gameData.id}`;

      client.to(room).emit(ServerEvents.GAME_OPPONENT_DISCONNECTED, {
        reconnectDeadline,
      });

      await dragonfly.set(
        `disconnect:${gameData.id}:${playerData.id}`,
        reconnectDeadline,
        'EX',
        30,
      );
    }

    this.logger.log(
      `Client ${client.id} disconnected (player ${playerData.id})`,
    );
  }

  @SubscribeMessage(ClientEvents.LOBBY_CREATE)
  async handleLobbyCreate(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = lobbyCreateSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit(ServerEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
      return;
    }

    this.logger.log(
      `lobby:create from ${client.id} — nickname=${parsed.data.nickname}`,
    );

    // Stub: actual game/player creation is T-007+ scope
    client.emit(ServerEvents.ERROR, {
      code: 'NOT_IMPLEMENTED',
      message: 'Lobby creation not yet implemented',
    });
  }

  @SubscribeMessage(ClientEvents.LOBBY_JOIN)
  async handleLobbyJoin(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = lobbyJoinSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit(ServerEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
      return;
    }

    this.logger.log(
      `lobby:join from ${client.id} — roomCode=${parsed.data.roomCode}`,
    );

    // Stub: actual join logic is T-007+ scope
    client.emit(ServerEvents.ERROR, {
      code: 'NOT_IMPLEMENTED',
      message: 'Lobby join not yet implemented',
    });
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(ClientEvents.GAME_MESSAGE)
  async handleGameMessage(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = gameMessageSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit(ServerEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
      return;
    }

    this.logger.log(
      `game:message from player ${client.data.player.id} — text length=${parsed.data.text.length}`,
    );

    // Stub: actual modifier pipeline is T-007+ scope
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(ClientEvents.VOTE_SUBMIT)
  async handleVoteSubmit(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = voteSubmitSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit(ServerEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
      return;
    }

    this.logger.log(
      `vote:submit from player ${client.data.player.id} — ${parsed.data.votes.length} vote(s)`,
    );

    // Stub: actual vote recording is later scope
  }

  @UseGuards(WsAuthGuard)
  @SubscribeMessage(ClientEvents.SURVEY_SUBMIT)
  async handleSurveySubmit(
    @MessageBody() payload: unknown,
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const parsed = surveySubmitSchema.safeParse(payload);
    if (!parsed.success) {
      client.emit(ServerEvents.ERROR, {
        code: 'VALIDATION_ERROR',
        message: parsed.error.message,
      });
      return;
    }

    this.logger.log(
      `survey:submit from player ${client.data.player.id} — rating=${parsed.data.rating}`,
    );

    // Stub: actual survey recording is later scope
  }
}
