import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TelegramBotService } from '../telegram-bot/telegram-bot.service';
import {
  type Lang,
  getLang,
  formatNotificationLocalized,
} from '../telegram-bot/telegram-bot.messages';
import { NotificationsGateway } from './notifications.gateway';
import {
  CreateNotificationDto,
  GetNotificationsQueryDto,
  NotificationResponseDto,
} from './dto/notification.dto';
import { NotificationType } from '@prisma/client';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramBotService: TelegramBotService,
    private readonly notificationsGateway: NotificationsGateway,
  ) {}

  /**
   * Create and send notification through all channels
   */
  async notify(dto: CreateNotificationDto): Promise<NotificationResponseDto> {
    // Default channels: in_app + telegram
    const channels = dto.channels || ['in_app', 'telegram'];

    // 1. Save notification to database
    const notification = await this.prisma.notification.create({
      data: {
        userId: dto.userId,
        type: dto.type,
        title: dto.title,
        message: dto.message,
        data: dto.data || {},
        channels,
      },
    });

    const response = this.toResponseDto(notification);

    // 2. Send via WebSocket (in-app) - non-blocking
    if (channels.includes('in_app')) {
      try {
        this.notificationsGateway.emitNotificationToUser(dto.userId, response);
      } catch (error) {
        this.logger.error(
          `Failed to emit notification via WebSocket: ${error.message}`,
          error,
        );
      }
    }

    // 3. Send via Telegram - non-blocking (localized per user language)
    if (channels.includes('telegram')) {
      this.sendToTelegram(
        notification.id,
        dto.userId,
        dto.type,
        dto.data || {},
      ).catch((error) => {
        this.logger.error(
          `Failed to send Telegram notification: ${error.message}`,
          error,
        );
      });
    }

    return response;
  }

  /**
   * Send notification to Telegram (localized per user language)
   */
  private async sendToTelegram(
    notificationId: string,
    userId: string,
    type: NotificationType,
    data: Record<string, any>,
  ): Promise<void> {
    try {
      // Get user's telegram chat ID and language
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          telegramChatId: true,
          telegramNotificationsEnabled: true,
          language: true,
        },
      });

      if (!user || !user.telegramNotificationsEnabled || !user.telegramChatId) {
        this.logger.debug(
          `User ${userId} does not have Telegram notifications enabled`,
        );
        return;
      }

      // Format localized message for Telegram
      const lang: Lang = getLang(user.language ?? undefined);
      const { title, message } = formatNotificationLocalized(type, data, lang);
      const telegramMessage = `<b>${title}</b>\n\n${message}`;

      // Send message
      await this.telegramBotService.sendMessage(
        user.telegramChatId,
        telegramMessage,
      );

      // Update notification with sent timestamp
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: { sentToTelegramAt: new Date() },
      });

      this.logger.log(
        `Sent Telegram notification to user ${userId} (chat: ${user.telegramChatId})`,
      );
    } catch (error) {
      // Save error to notification
      await this.prisma.notification.update({
        where: { id: notificationId },
        data: {
          telegramError: error.message || 'Unknown error',
        },
      });

      throw error;
    }
  }

  /**
   * Get notifications for user
   */
  async getNotifications(
    userId: string,
    query: GetNotificationsQueryDto,
  ): Promise<{
    notifications: NotificationResponseDto[];
    total: number;
    unreadCount: number;
  }> {
    const { limit = 20, offset = 0, type, unreadOnly } = query;

    const where: any = { userId };

    if (type) {
      where.type = type;
    }

    if (unreadOnly === 'true') {
      where.readAt = null;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
        skip: offset,
      }),
      this.prisma.notification.count({ where }),
      this.prisma.notification.count({
        where: { userId, readAt: null },
      }),
    ]);

    return {
      notifications: notifications.map(this.toResponseDto),
      total,
      unreadCount,
    };
  }

  /**
   * Mark notification as read
   */
  async markAsRead(
    notificationId: string,
    userId: string,
  ): Promise<NotificationResponseDto> {
    const notification = await this.prisma.notification.findFirst({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException('Notification not found');
    }

    if (notification.readAt) {
      // Already read
      return this.toResponseDto(notification);
    }

    const updated = await this.prisma.notification.update({
      where: { id: notificationId },
      data: { readAt: new Date() },
    });

    // Emit WebSocket event
    this.notificationsGateway.emitNotificationRead(userId, notificationId);

    return this.toResponseDto(updated);
  }

  /**
   * Mark all notifications as read for user
   */
  async markAllAsRead(userId: string): Promise<{ count: number }> {
    const result = await this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });

    // Emit WebSocket event
    this.notificationsGateway.emitAllNotificationsRead(userId);

    return { count: result.count };
  }

  /**
   * Get unread count for user
   */
  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { userId, readAt: null },
    });
  }

  /**
   * Helper to format notification templates by type
   */
  static formatNotification(
    type: NotificationType,
    data: Record<string, any>,
  ): { title: string; message: string } {
    switch (type) {
      case 'machine_expired_soon':
        return {
          title: '⏰ Machine Expiring Soon',
          message: `Your ${data.tierName || 'machine'} will expire in 24 hours! Don't forget to collect your earnings.`,
        };

      case 'machine_expired':
        return {
          title: '🎰 Machine Expired',
          message: `Your ${data.tierName || 'machine'} has completed its cycle. Total earned: $${data.totalEarned || 0}`,
        };

      case 'coin_box_full':
        return {
          title: '📦 Coin Box Full!',
          message: `Your ${data.tierName || 'machine'} coin box is full! Collect now or earnings will stop.`,
        };

      case 'coin_box_almost_full':
        return {
          title: '📦 Coin Box Almost Full',
          message: `Your ${data.tierName || 'machine'} coin box is 90% full. Collect soon!`,
        };

      case 'referral_joined':
        return {
          title: '👥 New Referral!',
          message: `${data.referralName || 'Someone'} joined using your referral link! You'll earn ${data.bonusPercent || 5}% from their deposits.`,
        };

      case 'deposit_credited':
        return {
          title: '💰 Deposit Credited',
          message: `$${data.amount || 0} has been added to your balance!`,
        };

      case 'deposit_rejected':
        return {
          title: '❌ Deposit Rejected',
          message: `Your deposit was rejected. Reason: ${data.reason || 'Unknown'}`,
        };

      case 'wheel_jackpot_won':
        return {
          title: '🎉 JACKPOT!',
          message: `Congratulations! You won $${data.amount || 0} on the Fortune Wheel!`,
        };

      case 'wheel_jackpot_alert':
        return {
          title: '🎰 Jackpot Won!',
          message: `${data.winnerName || 'Someone'} just won $${data.amount || 0} on the Wheel! Try your luck!`,
        };

      case 'withdrawal_approved':
        return {
          title: '✅ Withdrawal Approved',
          message: `Your withdrawal of $${data.amount || 0} has been approved and is being processed.`,
        };

      case 'withdrawal_completed':
        return {
          title: '✅ Withdrawal Completed',
          message: `Your withdrawal of $${data.amount || 0} has been sent successfully!`,
        };

      case 'withdrawal_rejected':
        return {
          title: '❌ Withdrawal Rejected',
          message: `Your withdrawal was rejected. Reason: ${data.reason || 'Unknown'}`,
        };

      default:
        return {
          title: 'Notification',
          message: 'You have a new notification',
        };
    }
  }

  /**
   * Convert Prisma model to DTO
   */
  private toResponseDto(notification: any): NotificationResponseDto {
    return {
      id: notification.id,
      type: notification.type,
      title: notification.title,
      message: notification.message,
      data: notification.data || null,
      channels: Array.isArray(notification.channels)
        ? notification.channels
        : [],
      readAt: notification.readAt,
      sentToTelegramAt: notification.sentToTelegramAt,
      telegramError: notification.telegramError,
      createdAt: notification.createdAt,
    };
  }
}
