import { Controller, Get } from '@nestjs/common';
import { FortuneRateService } from './fortune-rate.service';

@Controller('fortune-rate')
export class FortuneRateController {
  constructor(private readonly fortuneRateService: FortuneRateService) {}

  /**
   * Get current $FORTUNE token rate
   * Returns price in SOL and USD, market cap, and last update time
   */
  @Get()
  getRate() {
    const rate = this.fortuneRateService.getRate();
    return {
      success: true,
      data: {
        priceInSol: rate.priceInSol,
        priceInUsd: rate.priceInUsd,
        marketCapSol: rate.marketCapSol,
        marketCapUsd: rate.marketCapUsd,
        solPriceUsd: rate.solPriceUsd,
        updatedAt: rate.updatedAt.toISOString(),
      },
    };
  }

  /**
   * Convert USD to FORTUNE tokens
   */
  @Get('convert/usd-to-fortune')
  convertUsdToFortune() {
    // Example: convert $1 to FORTUNE
    const rate = this.fortuneRateService.getRate();
    const fortunePerUsd = rate.priceInUsd > 0 ? 1 / rate.priceInUsd : 10;

    return {
      success: true,
      data: {
        rate: fortunePerUsd,
        example: {
          usd: 1,
          fortune: fortunePerUsd,
        },
      },
    };
  }
}
