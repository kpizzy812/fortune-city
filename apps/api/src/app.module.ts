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
import { SettingsModule } from './modules/settings/settings.module';
import { ReferralsModule } from './modules/referrals/referrals.module';
import { FortuneRateModule } from './modules/fortune-rate/fortune-rate.module';
import { DepositsModule } from './modules/deposits/deposits.module';
import { WithdrawalsModule } from './modules/withdrawals/withdrawals.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    ScheduleModule.forRoot(),
    PrismaModule,
    SettingsModule,
    UsersModule,
    AuthModule,
    MachinesModule,
    EconomyModule,
    MachineLifecycleModule,
    ReferralsModule,
    FortuneRateModule,
    DepositsModule,
    WithdrawalsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
