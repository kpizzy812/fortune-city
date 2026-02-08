import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { FameModule } from '../fame/fame.module';
import { WheelController } from './wheel.controller';
import { WheelService } from './wheel.service';
import { WheelGateway } from './wheel.gateway';
import { WheelNotificationService } from './wheel-notification.service';

@Module({
  imports: [
    PrismaModule,
    SettingsModule,
    AuthModule,
    forwardRef(() => ReferralsModule),
    FameModule,
  ],
  controllers: [WheelController],
  providers: [WheelService, WheelGateway, WheelNotificationService],
  exports: [WheelService],
})
export class WheelModule {}
