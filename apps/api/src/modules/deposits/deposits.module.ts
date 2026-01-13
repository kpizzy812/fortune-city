import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FortuneRateModule } from '../fortune-rate/fortune-rate.module';
import { DepositsController, WebhooksController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { SolanaRpcService } from './services/solana-rpc.service';
import { AddressGeneratorService } from './services/address-generator.service';
import { HeliusWebhookService } from './services/helius-webhook.service';
import { DepositProcessorService } from './services/deposit-processor.service';
import { SweepService } from './services/sweep.service';
import { PriceOracleService } from './services/price-oracle.service';

@Module({
  imports: [
    ConfigModule,
    PrismaModule,
    AuthModule,
    FortuneRateModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [DepositsController, WebhooksController],
  providers: [
    DepositsService,
    SolanaRpcService,
    AddressGeneratorService,
    HeliusWebhookService,
    DepositProcessorService,
    SweepService,
    PriceOracleService,
  ],
  exports: [DepositsService, SolanaRpcService, PriceOracleService],
})
export class DepositsModule {}
