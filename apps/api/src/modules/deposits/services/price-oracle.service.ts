import { Injectable, Logger } from '@nestjs/common';
import { FortuneRateService } from '../../fortune-rate/fortune-rate.service';
import { ConfigService } from '@nestjs/config';

/**
 * PriceOracleService - thin wrapper around FortuneRateService
 * All caching and rate limiting is handled by FortuneRateService
 */
@Injectable()
export class PriceOracleService {
  private readonly logger = new Logger(PriceOracleService.name);
  private priceCache: Map<string, { price: number; timestamp: number }> =
    new Map();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private fortuneRateService: FortuneRateService,
    private config: ConfigService,
  ) {}

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
  getFortunePrice(): number {
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
        const fortunePrice = this.getFortunePrice();
        return amount * fortunePrice;
      }

      default:
        throw new Error(`Unknown currency: ${String(currency)}`);
    }
  }

  /**
   * Get price for BNB or TON from CoinGecko API
   * Cached for 5 minutes to avoid rate limiting
   */
  async getPrice(ticker: 'BNB' | 'TON'): Promise<number> {
    // Check cache
    const cached = this.priceCache.get(ticker);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    // Fetch from CoinGecko
    try {
      const price = await this.fetchPriceFromCoinGecko(ticker);
      this.priceCache.set(ticker, { price, timestamp: Date.now() });
      return price;
    } catch (error) {
      this.logger.error(
        `Failed to fetch ${ticker} price from CoinGecko`,
        error,
      );

      // Return cached value if available (even if expired)
      if (cached) {
        this.logger.warn(
          `Using expired cache for ${ticker} price: ${cached.price}`,
        );
        return cached.price;
      }

      throw new Error(`${ticker} price unavailable`);
    }
  }

  /**
   * Fetch price from CoinGecko API
   */
  private async fetchPriceFromCoinGecko(
    ticker: 'BNB' | 'TON',
  ): Promise<number> {
    const coinGeckoIds: Record<string, string> = {
      BNB: 'binancecoin',
      TON: 'the-open-network',
    };

    const coinId = coinGeckoIds[ticker];
    const apiKey = this.config.get<string>('COINGECKO_API_KEY');

    const url = apiKey
      ? `https://pro-api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd&x_cg_pro_api_key=${apiKey}`
      : `https://api.coingecko.com/api/v3/simple/price?ids=${coinId}&vs_currencies=usd`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(
        `CoinGecko API error: ${response.status} ${response.statusText}`,
      );
    }

    const data = await response.json();
    const price = data[coinId]?.usd;

    if (!price || typeof price !== 'number' || price <= 0) {
      throw new Error(`Invalid price data from CoinGecko for ${ticker}`);
    }

    this.logger.log(`Fetched ${ticker} price from CoinGecko: $${price}`);
    return price;
  }
}
