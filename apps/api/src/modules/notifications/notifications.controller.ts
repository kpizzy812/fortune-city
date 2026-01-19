import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  GetNotificationsQueryDto,
  MarkAsReadDto,
  NotificationResponseDto,
} from './dto/notification.dto';

@Controller('notifications')
@UseGuards(JwtAuthGuard)
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  /**
   * Get notifications for current user
   * GET /notifications
   */
  @Get()
  async getNotifications(
    @Req() req: any,
    @Query() query: GetNotificationsQueryDto,
  ): Promise<{
    notifications: NotificationResponseDto[];
    total: number;
    unreadCount: number;
  }> {
    const userId = req.user.sub;
    return this.notificationsService.getNotifications(userId, query);
  }

  /**
   * Get unread count for current user
   * GET /notifications/unread-count
   */
  @Get('unread-count')
  async getUnreadCount(@Req() req: any): Promise<{ count: number }> {
    const userId = req.user.sub;
    const count = await this.notificationsService.getUnreadCount(userId);
    return { count };
  }

  /**
   * Mark notification as read
   * POST /notifications/:id/read
   */
  @Post(':id/read')
  async markAsRead(
    @Param('id') notificationId: string,
    @Req() req: any,
  ): Promise<NotificationResponseDto> {
    const userId = req.user.sub;
    return this.notificationsService.markAsRead(notificationId, userId);
  }

  /**
   * Mark all notifications as read
   * POST /notifications/read-all
   */
  @Post('read-all')
  async markAllAsRead(@Req() req: any): Promise<{ count: number }> {
    const userId = req.user.sub;
    return this.notificationsService.markAllAsRead(userId);
  }
}
