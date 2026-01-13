import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron, CronExpression } from '@nestjs/schedule';

interface PriceCache {
  sol: number;
  fortune: number;
  usdt: number;
  updatedAt: Date;
}

@Injectable()
export class PriceOracleService {
  private readonly logger = new Logger(PriceOracleService.name);
  private cache: PriceCache = {
    sol: 0,
    fortune: 0,
    usdt: 1, // USDT is always 1 USD
    updatedAt: new Date(0),
  };

  // Cache TTL in milliseconds (60 seconds)
  private readonly CACHE_TTL = 60 * 1000;

  constructor(private config: ConfigService) {}

  /**
   * Get SOL price in USD
   */
  async getSolPrice(): Promise<number> {
    await this.ensureFreshCache();
    return this.cache.sol;
  }

  /**
   * Get FORTUNE price in USD
   * Uses FortuneRateService if available, otherwise fetches from price source
   */
  async getFortunePrice(): Promise<number> {
    await this.ensureFreshCache();
    return this.cache.fortune;
  }

  /**
   * Get all rates
   */
  async getRates(): Promise<{ sol: number; fortune: number; usdt: number }> {
    await this.ensureFreshCache();
    return {
      sol: this.cache.sol,
      fortune: this.cache.fortune,
      usdt: this.cache.usdt,
    };
  }

  /**
   * Ensure cache is fresh, fetch if stale
   */
  private async ensureFreshCache(): Promise<void> {
    const now = Date.now();
    const cacheAge = now - this.cache.updatedAt.getTime();

    if (cacheAge < this.CACHE_TTL && this.cache.sol > 0) {
      return; // Cache is fresh
    }

    await this.fetchPrices();
  }

  /**
   * Fetch prices from CoinGecko API
   * Runs on schedule to keep cache warm
   */
  @Cron(CronExpression.EVERY_MINUTE)
  async fetchPrices(): Promise<void> {
    try {
      // Fetch SOL price from CoinGecko
      const solPrice = await this.fetchSolPriceFromCoinGecko();

      // Get FORTUNE price (you might want to use your existing FortuneRateService)
      const fortunePrice = await this.fetchFortunePriceInternal();

      this.cache = {
        sol: solPrice,
        fortune: fortunePrice,
        usdt: 1,
        updatedAt: new Date(),
      };

      this.logger.debug(
        `Prices updated: SOL=$${solPrice}, FORTUNE=$${fortunePrice}`,
      );
    } catch (error) {
      this.logger.error('Failed to fetch prices', error);
      // Keep old cache values if fetch fails
    }
  }

  /**
   * Fetch SOL price from CoinGecko
   */
  private async fetchSolPriceFromCoinGecko(): Promise<number> {
    const apiKey = this.config.get<string>('COINGECKO_API_KEY');

    const url = apiKey
      ? `https://pro-api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd&x_cg_pro_api_key=${apiKey}`
      : 'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd';

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`CoinGecko API error: ${response.status}`);
    }

    const data = (await response.json()) as { solana?: { usd?: number } };
    return data.solana?.usd ?? 0;
  }

  /**
   * Fetch FORTUNE price
   * This should integrate with your existing FortuneRateService
   * For now, we use a placeholder implementation
   */
  private async fetchFortunePriceInternal(): Promise<number> {
    // TODO: Integrate with FortuneRateService
    // For now, return a placeholder value
    // In production, this should call your existing fortune rate logic

    // Fallback: 1 USD = 10 FORTUNE (0.1 USD per FORTUNE)
    const fallbackRate = 0.1;

    try {
      // Try to get from existing fortune rate endpoint if available
      const apiUrl = this.config.get<string>('API_URL');
      if (apiUrl) {
        const response = await fetch(`${apiUrl}/fortune-rate`);
        if (response.ok) {
          const data = (await response.json()) as { priceInUsd?: number };
          if (data.priceInUsd) {
            return data.priceInUsd;
          }
        }
      }
    } catch {
      // Fallback on error
    }

    return fallbackRate;
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
        return 0;
    }
  }
}
