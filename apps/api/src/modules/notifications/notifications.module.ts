import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationsGateway } from './notifications.gateway';
import { PrismaModule } from '../prisma/prisma.module';
import { TelegramBotModule } from '../telegram-bot/telegram-bot.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, TelegramBotModule, AuthModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, NotificationsGateway],
  exports: [NotificationsService], // Export for use in other modules
})
export class NotificationsModule {}
