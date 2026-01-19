import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { NotificationResponseDto } from './dto/notification.dto';

@WebSocketGateway({
  cors: { origin: '*' },
  namespace: '/notifications',
})
export class NotificationsGateway
  implements OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(NotificationsGateway.name);
  private readonly userSockets = new Map<string, Set<string>>(); // userId -> Set of socketIds

  handleConnection(client: Socket): void {
    this.logger.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);

    // Remove socket from all user subscriptions
    for (const [userId, sockets] of this.userSockets.entries()) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }
  }

  /**
   * Subscribe to notifications for a specific user
   */
  @SubscribeMessage('subscribe')
  handleSubscribe(client: Socket, userId: string): void {
    if (!userId) {
      this.logger.warn(`Invalid userId for subscription: ${userId}`);
      return;
    }

    if (!this.userSockets.has(userId)) {
      this.userSockets.set(userId, new Set());
    }

    this.userSockets.get(userId)!.add(client.id);
    this.logger.log(`Client ${client.id} subscribed to notifications for user ${userId}`);

    client.emit('subscribed', { userId, success: true });
  }

  /**
   * Unsubscribe from user notifications
   */
  @SubscribeMessage('unsubscribe')
  handleUnsubscribe(client: Socket, userId: string): void {
    const sockets = this.userSockets.get(userId);
    if (sockets) {
      sockets.delete(client.id);
      if (sockets.size === 0) {
        this.userSockets.delete(userId);
      }
    }

    this.logger.log(`Client ${client.id} unsubscribed from user ${userId}`);
    client.emit('unsubscribed', { userId, success: true });
  }

  /**
   * Emit notification to specific user (all their connected clients)
   */
  emitNotificationToUser(
    userId: string,
    notification: NotificationResponseDto,
  ): void {
    const sockets = this.userSockets.get(userId);

    if (!sockets || sockets.size === 0) {
      this.logger.debug(`No connected clients for user ${userId}`);
      return;
    }

    const payload = {
      notification,
      timestamp: new Date(),
    };

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification:new', payload);
    });

    this.logger.log(`Emitted notification to ${sockets.size} client(s) for user ${userId}`);
  }

  /**
   * Emit notification read status update to user
   */
  emitNotificationRead(userId: string, notificationId: string): void {
    const sockets = this.userSockets.get(userId);

    if (!sockets || sockets.size === 0) {
      return;
    }

    const payload = {
      notificationId,
      readAt: new Date(),
    };

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification:read', payload);
    });
  }

  /**
   * Emit bulk read status (mark all as read)
   */
  emitAllNotificationsRead(userId: string): void {
    const sockets = this.userSockets.get(userId);

    if (!sockets || sockets.size === 0) {
      return;
    }

    const payload = {
      readAt: new Date(),
    };

    sockets.forEach((socketId) => {
      this.server.to(socketId).emit('notification:all_read', payload);
    });
  }
}
