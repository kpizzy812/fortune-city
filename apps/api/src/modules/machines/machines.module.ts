import { Module } from '@nestjs/common';
import { MachinesController } from './machines.controller';
import { MachinesService } from './machines.service';
import { RiskyCollectService } from './services/risky-collect.service';
import { AutoCollectService } from './services/auto-collect.service';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [MachinesController],
  providers: [MachinesService, RiskyCollectService, AutoCollectService],
  exports: [MachinesService, RiskyCollectService, AutoCollectService],
})
export class MachinesModule {}
