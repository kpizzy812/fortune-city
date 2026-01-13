import { Injectable, Logger } from '@nestjs/common';
import { FortuneRateService } from '../../fortune-rate/fortune-rate.service';

/**
 * PriceOracleService - thin wrapper around FortuneRateService
 * All caching and rate limiting is handled by FortuneRateService
 */
@Injectable()
export class PriceOracleService {
  private readonly logger = new Logger(PriceOracleService.name);

  constructor(private fortuneRateService: FortuneRateService) {}

  /**
   * Get SOL price in USD (from FortuneRateService cache)
   */
  async getSolPrice(): Promise<number> {
    const price = await this.fortuneRateService.ensureFreshSolPrice();
    if (price <= 0) {
      throw new Error('SOL price unavailable');
    }
    return price;
  }

  /**
   * Get FORTUNE price in USD from FortuneRateService
   * Throws error if rate is unavailable (no fallback!)
   */
  async getFortunePrice(): Promise<number> {
    const rate = this.fortuneRateService.getRate();
    if (!rate || rate.priceInUsd <= 0) {
      throw new Error(
        'FORTUNE price unavailable - FortuneRateService not ready',
      );
    }
    return rate.priceInUsd;
  }

  /**
   * Get all rates
   */
  async getRates(): Promise<{
    sol: number;
    fortune: number | null;
    usdt: number;
  }> {
    const solPrice = await this.fortuneRateService.ensureFreshSolPrice();
    const fortuneRate = this.fortuneRateService.getRate();

    return {
      sol: solPrice,
      fortune: fortuneRate?.priceInUsd ?? null,
      usdt: 1, // USDT is always 1:1 with USD
    };
  }

  /**
   * Check if FORTUNE rate is available
   */
  isFortuneRateAvailable(): boolean {
    return this.fortuneRateService.isRateAvailable();
  }

  /**
   * Convert amount to USD
   */
  async convertToUsd(
    currency: 'SOL' | 'USDT_SOL' | 'FORTUNE',
    amount: number,
  ): Promise<number> {
    switch (currency) {
      case 'USDT_SOL':
        return amount; // 1:1

      case 'SOL': {
        const solPrice = await this.getSolPrice();
        return amount * solPrice;
      }

      case 'FORTUNE': {
        const fortunePrice = await this.getFortunePrice();
        return amount * fortunePrice;
      }

      default:
        throw new Error(`Unknown currency: ${currency}`);
    }
  }
}
