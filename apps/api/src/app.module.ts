import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { MachinesModule } from './modules/machines/machines.module';
import { EconomyModule } from './modules/economy/economy.module';
import { MachineLifecycleModule } from './modules/machine-lifecycle/machine-lifecycle.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    UsersModule,
    AuthModule,
    MachinesModule,
    EconomyModule,
    MachineLifecycleModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
