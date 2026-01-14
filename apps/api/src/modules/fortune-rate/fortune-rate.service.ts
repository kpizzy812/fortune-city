import {
  Injectable,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import WebSocket from 'ws';

interface TradeEvent {
  signature: string;
  mint: string;
  traderPublicKey: string;
  txType: 'buy' | 'sell';
  tokenAmount: number;
  vSolInBondingCurve: number;
  vTokensInBondingCurve: number;
  marketCapSol: number;
  bondingCurveKey: string;
  newTokenBalance: number;
}

interface FortuneRate {
  priceInSol: number;
  priceInUsd: number;
  marketCapSol: number;
  marketCapUsd: number;
  solPriceUsd: number;
  updatedAt: Date;
}

@Injectable()
export class FortuneRateService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FortuneRateService.name);
  private ws: WebSocket | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private reconnectDelay = 5000;
  private reconnectTimer: NodeJS.Timeout | null = null;

  // Cached rate data
  private cachedRate: FortuneRate | null = null;
  private cachedSolPrice: number = 0;
  private solPriceUpdatedAt: Date | null = null;
  private readonly SOL_PRICE_CACHE_TTL = 300000; // 5 minutes - SOL price doesn't change that fast

  // Rate limiting protection
  private isFetchingSolPrice = false;
  private rateLimitBackoffUntil: Date | null = null;
  private readonly RATE_LIMIT_BACKOFF = 60000; // 1 minute backoff after 429

  // Config
  private readonly fortuneMintAddress: string;
  private readonly wsUrl = 'wss://pumpportal.fun/api/data';

  constructor(private readonly configService: ConfigService) {
    this.fortuneMintAddress = this.configService.get<string>(
      'FORTUNE_MINT_ADDRESS',
      '', // Default empty - will use fallback rate
    );
  }

  async onModuleInit() {
    if (!this.fortuneMintAddress) {
      this.logger.warn(
        'FORTUNE_MINT_ADDRESS not configured. Rate will be unavailable.',
      );
      return;
    }

    await this.initializeSolPrice();
    this.connectWebSocket();
  }

  onModuleDestroy() {
    this.disconnect();
  }

  /**
   * Get current $FORTUNE rate (null if unavailable)
   */
  getRate(): FortuneRate | null {
    return this.cachedRate;
  }

  /**
   * Check if rate is available
   */
  isRateAvailable(): boolean {
    return this.cachedRate !== null && this.cachedRate.priceInUsd > 0;
  }

  /**
   * Convert USD amount to FORTUNE tokens (returns null if rate unavailable)
   */
  usdToFortune(usdAmount: number): number | null {
    if (!this.cachedRate || this.cachedRate.priceInUsd <= 0) return null;
    return usdAmount / this.cachedRate.priceInUsd;
  }

  /**
   * Convert FORTUNE tokens to USD (returns null if rate unavailable)
   */
  fortuneToUsd(fortuneAmount: number): number | null {
    if (!this.cachedRate) return null;
    return fortuneAmount * this.cachedRate.priceInUsd;
  }

  /**
   * Get cached SOL price in USD
   * Used by other services to avoid duplicate CoinGecko calls
   */
  getSolPrice(): number {
    return this.cachedSolPrice;
  }

  /**
   * Ensure SOL price is fresh (public wrapper)
   */
  async ensureFreshSolPrice(): Promise<number> {
    await this.ensureSolPrice();
    return this.cachedSolPrice;
  }

  // ==================== Private Methods ====================

  private connectWebSocket() {
    if (this.ws) {
      this.ws.close();
    }

    this.logger.log(`Connecting to PumpPortal WebSocket...`);

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      this.logger.log('Connected to PumpPortal WebSocket');
      this.reconnectAttempts = 0;
      this.subscribeToToken();
    });

    this.ws.on('message', (rawData: WebSocket.Data) => {
      try {
        const dataStr = typeof rawData === 'string' ? rawData : String(rawData);
        const message = JSON.parse(dataStr) as TradeEvent;
        this.handleTradeEvent(message);
      } catch (error) {
        this.logger.error('Failed to parse WebSocket message', error);
      }
    });

    this.ws.on('error', (error) => {
      this.logger.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      this.logger.warn('WebSocket connection closed');
      this.scheduleReconnect();
    });
  }

  private subscribeToToken() {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return;

    const payload = {
      method: 'subscribeTokenTrade',
      keys: [this.fortuneMintAddress],
    };

    this.ws.send(JSON.stringify(payload));
    this.logger.log(`Subscribed to token trades: ${this.fortuneMintAddress}`);
  }

  private async handleTradeEvent(event: TradeEvent) {
    if (event.mint !== this.fortuneMintAddress) return;

    // Calculate price from bonding curve
    const priceInSol =
      event.vTokensInBondingCurve > 0
        ? event.vSolInBondingCurve / event.vTokensInBondingCurve
        : 0;

    // Get fresh SOL price if needed
    await this.ensureSolPrice();

    const priceInUsd = priceInSol * this.cachedSolPrice;
    const marketCapUsd = event.marketCapSol * this.cachedSolPrice;

    this.cachedRate = {
      priceInSol,
      priceInUsd,
      marketCapSol: event.marketCapSol,
      marketCapUsd,
      solPriceUsd: this.cachedSolPrice,
      updatedAt: new Date(),
    };

    this.logger.debug(
      `Rate updated: $${priceInUsd.toFixed(10)} (${priceInSol.toFixed(12)} SOL)`,
    );
  }

  private scheduleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.logger.error(
        'Max reconnect attempts reached. Rate will be unavailable.',
      );
      return;
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }

    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);

    this.logger.log(
      `Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`,
    );

    this.reconnectTimer = setTimeout(() => {
      this.connectWebSocket();
    }, delay);
  }

  private disconnect() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  // ==================== SOL Price ====================

  private async initializeSolPrice() {
    await this.fetchSolPrice();
  }

  private async ensureSolPrice() {
    const now = new Date();

    // Check if cache is still valid
    if (
      this.solPriceUpdatedAt &&
      now.getTime() - this.solPriceUpdatedAt.getTime() <=
        this.SOL_PRICE_CACHE_TTL
    ) {
      return; // Cache is fresh
    }

    // Check if we're in rate limit backoff
    if (this.rateLimitBackoffUntil && now < this.rateLimitBackoffUntil) {
      return; // Still in backoff, use cached value
    }

    // Prevent concurrent fetches
    if (this.isFetchingSolPrice) {
      return; // Another fetch is in progress
    }

    await this.fetchSolPrice();
  }

  private async fetchSolPrice() {
    // Double-check lock
    if (this.isFetchingSolPrice) return;
    this.isFetchingSolPrice = true;

    try {
      // CoinGecko free API for SOL price
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      );

      if (response.status === 429) {
        // Rate limited - set backoff
        this.rateLimitBackoffUntil = new Date(
          Date.now() + this.RATE_LIMIT_BACKOFF,
        );
        this.logger.warn(
          `CoinGecko rate limited. Backing off for ${this.RATE_LIMIT_BACKOFF / 1000}s`,
        );
        return;
      }

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = (await response.json()) as { solana?: { usd?: number } };
      const price = data.solana?.usd;

      if (!price || price <= 0) {
        throw new Error('Invalid SOL price from CoinGecko');
      }

      this.cachedSolPrice = price;
      this.solPriceUpdatedAt = new Date();
      this.rateLimitBackoffUntil = null; // Clear backoff on success

      this.logger.debug(`SOL price updated: $${this.cachedSolPrice}`);
    } catch (error) {
      this.logger.error('Failed to fetch SOL price', error);
      // Keep existing cached value if available, otherwise leave as 0
    } finally {
      this.isFetchingSolPrice = false;
    }
  }
}
