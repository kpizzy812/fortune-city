import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { WheelController } from './wheel.controller';
import { WheelService } from './wheel.service';

@Module({
  imports: [PrismaModule, SettingsModule, AuthModule],
  controllers: [WheelController],
  providers: [WheelService],
  exports: [WheelService],
})
export class WheelModule {}
