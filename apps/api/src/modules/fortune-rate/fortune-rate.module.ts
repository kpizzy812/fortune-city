import { Module } from '@nestjs/common';
import { FortuneRateService } from './fortune-rate.service';
import { FortuneRateController } from './fortune-rate.controller';

@Module({
  controllers: [FortuneRateController],
  providers: [FortuneRateService],
  exports: [FortuneRateService],
})
export class FortuneRateModule {}
