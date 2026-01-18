import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayInit,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';

export interface DepositCreditedEvent {
  depositId: string;
  userId: string;
  amount: number; // Original amount in crypto
  currency: string; // SOL, USDT_SOL, FORTUNE
  amountUsd: number; // Credited USD amount
  newBalance: number; // New user balance
  timestamp: string;
}

@WebSocketGateway({
  cors: {
    origin: '*',
  },
  namespace: '/deposits',
})
export class DepositsGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(DepositsGateway.name);
  private userSockets: Map<string, Set<string>> = new Map();

  @WebSocketServer()
  server: Server;

  afterInit() {
    this.logger.log('Deposits WebSocket Gateway initialized');
  }

  handleConnection(client: Socket) {
    this.logger.debug(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    this.logger.debug(`Client disconnected: ${client.id}`);
    // Remove from user mapping
    this.userSockets.forEach((sockets, userId) => {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    });
  }

  /**
   * Client subscribes to their deposit notifications
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, userId: string) {
    if (!userId) {
      this.logger.warn(`Client ${client.id} tried to subscribe without userId`);
      return;
    }

    // Join user-specific room
    client.join(`user:${userId}`);

    // Track socket -> user mapping
    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }
    this.userSockets.get(userId)!.add(client.id);

    this.logger.debug(`Client ${client.id} subscribed to user ${userId}`);
    return { success: true };
  }

  /**
   * Client unsubscribes from notifications
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, userId: string) {
    if (!userId) return;

    client.leave(`user:${userId}`);

    const userSockets = this.userSockets.get(userId);
    if (userSockets) {
      userSockets.delete(client.id);
      if (userSockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.debug(`Client ${client.id} unsubscribed from user ${userId}`);
    return { success: true };
  }

  /**
   * Emit deposit credited event to specific user
   */
  emitDepositCredited(data: DepositCreditedEvent) {
    this.logger.log(
      `Emitting deposit:credited to user ${data.userId}: $${data.amountUsd}`,
    );
    // Send to user-specific room
    this.server.to(`user:${data.userId}`).emit('deposit:credited', data);
  }
}
