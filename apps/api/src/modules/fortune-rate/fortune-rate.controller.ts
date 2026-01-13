import { Controller, Get } from '@nestjs/common';
import { FortuneRateService } from './fortune-rate.service';

@Controller('fortune-rate')
export class FortuneRateController {
  constructor(private readonly fortuneRateService: FortuneRateService) {}

  /**
   * Get current $FORTUNE token rate
   * Returns null data if rate is unavailable (no mint address configured or connection failed)
   */
  @Get()
  getRate() {
    const rate = this.fortuneRateService.getRate();

    if (!rate) {
      return {
        success: true,
        data: null,
      };
    }

    return {
      success: true,
      data: {
        priceInSol: rate.priceInSol,
        priceInUsd: rate.priceInUsd,
        fortunePerUsd: rate.priceInUsd > 0 ? 1 / rate.priceInUsd : null,
        marketCapSol: rate.marketCapSol,
        marketCapUsd: rate.marketCapUsd,
        solPriceUsd: rate.solPriceUsd,
        updatedAt: rate.updatedAt.toISOString(),
        source: 'pumpportal' as const,
      },
    };
  }
}
