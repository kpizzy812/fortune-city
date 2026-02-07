import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SettingsModule } from '../settings/settings.module';
import { AuthModule } from '../auth/auth.module';
import { FameController } from './fame.controller';
import { FameService } from './fame.service';

@Module({
  imports: [PrismaModule, SettingsModule, AuthModule],
  controllers: [FameController],
  providers: [FameService],
  exports: [FameService],
})
export class FameModule {}
