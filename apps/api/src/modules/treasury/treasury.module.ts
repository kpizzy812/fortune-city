import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DepositsModule } from '../deposits/deposits.module';
import { TreasuryService } from './treasury.service';
import { TreasuryController } from './treasury.controller';

@Module({
  imports: [ConfigModule, DepositsModule],
  controllers: [TreasuryController],
  providers: [TreasuryService],
  exports: [TreasuryService],
})
export class TreasuryModule {}
