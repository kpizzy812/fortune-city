import { Module } from '@nestjs/common';
import { MachineLifecycleService } from './machine-lifecycle.service';
import { MachinesModule } from '../machines/machines.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [MachinesModule, NotificationsModule, PrismaModule],
  providers: [MachineLifecycleService],
  exports: [MachineLifecycleService],
})
export class MachineLifecycleModule {}
