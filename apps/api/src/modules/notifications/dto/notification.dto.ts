import { IsEnum, IsString, IsOptional, IsObject, IsArray, IsInt, Min, Max } from 'class-validator';
import { NotificationType } from '@prisma/client';

export class CreateNotificationDto {
  @IsString()
  userId: string;

  @IsEnum(NotificationType)
  type: NotificationType;

  @IsString()
  title: string;

  @IsString()
  message: string;

  @IsObject()
  @IsOptional()
  data?: Record<string, any>;

  @IsArray()
  @IsOptional()
  channels?: string[]; // ['in_app', 'telegram']
}

export class GetNotificationsQueryDto {
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  limit?: number = 20;

  @IsInt()
  @Min(0)
  @IsOptional()
  offset?: number = 0;

  @IsEnum(NotificationType)
  @IsOptional()
  type?: NotificationType;

  @IsString()
  @IsOptional()
  unreadOnly?: string; // "true" | "false"
}

export class MarkAsReadDto {
  @IsString()
  notificationId: string;
}

export class NotificationResponseDto {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, any> | null;
  channels: string[];
  readAt: Date | null;
  sentToTelegramAt: Date | null;
  telegramError: string | null;
  createdAt: Date;
}
