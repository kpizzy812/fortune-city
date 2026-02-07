import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { DepositsModule } from '../deposits/deposits.module';
import { EconomyModule } from '../economy/economy.module';
import { TreasuryModule } from '../treasury/treasury.module';
import { WithdrawalsController } from './withdrawals.controller';
import { WithdrawalsService } from './withdrawals.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    DepositsModule, // For SolanaRpcService
    EconomyModule, // For FundSourceService
    TreasuryModule, // For vault payout before withdrawal
  ],
  controllers: [WithdrawalsController],
  providers: [WithdrawalsService],
  exports: [WithdrawalsService],
})
export class WithdrawalsModule {}
