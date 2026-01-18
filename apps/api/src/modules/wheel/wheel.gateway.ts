import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface JackpotWonEvent {
  winnerId: string;
  winnerName: string | null;
  amount: number;
  newPool: number;
  timestamp: string;
}

export interface JackpotUpdatedEvent {
  currentPool: number;
  timestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/wheel',
})
export class WheelGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(WheelGateway.name);

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Wheel WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
  }

  /**
   * Broadcast jackpot won event to all connected clients
   */
  emitJackpotWon(data: JackpotWonEvent) {
    this.logger.log(
      `Broadcasting jackpot won: $${data.amount} to ${data.winnerName || 'Anonymous'}`,
    );
    this.server.emit('jackpot:won', data);
  }

  /**
   * Broadcast jackpot pool update to all connected clients
   */
  emitJackpotUpdated(data: JackpotUpdatedEvent) {
    this.server.emit('jackpot:updated', data);
  }
}
