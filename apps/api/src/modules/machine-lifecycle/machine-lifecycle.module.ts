import { Module } from '@nestjs/common';
import { MachineLifecycleService } from './machine-lifecycle.service';
import { MachinesModule } from '../machines/machines.module';

@Module({
  imports: [MachinesModule],
  providers: [MachineLifecycleService],
  exports: [MachineLifecycleService],
})
export class MachineLifecycleModule {}
