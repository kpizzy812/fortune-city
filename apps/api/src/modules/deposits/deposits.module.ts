import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { PrismaModule } from '../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';
import { FortuneRateModule } from '../fortune-rate/fortune-rate.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { DepositsController, WebhooksController } from './deposits.controller';
import { DepositsService } from './deposits.service';
import { DepositsGateway } from './deposits.gateway';
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
    NotificationsModule,
    ScheduleModule.forRoot(),
  ],
  controllers: [DepositsController, WebhooksController],
  providers: [
    DepositsService,
    DepositsGateway,
    SolanaRpcService,
    AddressGeneratorService,
    HeliusWebhookService,
    DepositProcessorService,
    SweepService,
    PriceOracleService,
  ],
  exports: [
    DepositsService,
    DepositsGateway,
    SolanaRpcService,
    PriceOracleService,
  ],
})
export class DepositsModule {}
