import { Module, forwardRef } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MachinesModule } from '../machines/machines.module';
import { AuthModule } from '../auth/auth.module';
import { ReferralsModule } from '../referrals/referrals.module';
import { EconomyController } from './economy.controller';
import { TransactionsService } from './services/transactions.service';
import { FundSourceService } from './services/fund-source.service';
import { PurchaseService } from './services/purchase.service';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => MachinesModule),
    AuthModule,
    ReferralsModule,
  ],
  controllers: [EconomyController],
  providers: [TransactionsService, FundSourceService, PurchaseService],
  exports: [TransactionsService, FundSourceService, PurchaseService],
})
export class EconomyModule {}
