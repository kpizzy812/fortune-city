import { Injectable, Logger, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
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
  private readonly SOL_PRICE_CACHE_TTL = 60000; // 1 minute

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
        'FORTUNE_MINT_ADDRESS not configured. Using fallback rate.',
      );
      this.setFallbackRate();
      return;
    }

    await this.initializeSolPrice();
    this.connectWebSocket();
  }

  onModuleDestroy() {
    this.disconnect();
  }

  /**
   * Get current $FORTUNE rate
   */
  getRate(): FortuneRate {
    if (!this.cachedRate) {
      return this.getFallbackRate();
    }
    return this.cachedRate;
  }

  /**
   * Convert USD amount to FORTUNE tokens
   */
  usdToFortune(usdAmount: number): number {
    const rate = this.getRate();
    if (rate.priceInUsd <= 0) return usdAmount * 10; // Fallback 1:10
    return usdAmount / rate.priceInUsd;
  }

  /**
   * Convert FORTUNE tokens to USD
   */
  fortuneToUsd(fortuneAmount: number): number {
    const rate = this.getRate();
    return fortuneAmount * rate.priceInUsd;
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

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
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
      this.logger.error('Max reconnect attempts reached. Using fallback rate.');
      this.setFallbackRate();
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
    if (
      !this.solPriceUpdatedAt ||
      now.getTime() - this.solPriceUpdatedAt.getTime() > this.SOL_PRICE_CACHE_TTL
    ) {
      await this.fetchSolPrice();
    }
  }

  private async fetchSolPrice() {
    try {
      // CoinGecko free API for SOL price
      const response = await fetch(
        'https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd',
      );

      if (!response.ok) {
        throw new Error(`CoinGecko API error: ${response.status}`);
      }

      const data = await response.json();
      this.cachedSolPrice = data.solana?.usd || 150; // Fallback to $150
      this.solPriceUpdatedAt = new Date();

      this.logger.debug(`SOL price updated: $${this.cachedSolPrice}`);
    } catch (error) {
      this.logger.error('Failed to fetch SOL price, using cached value', error);
      if (!this.cachedSolPrice) {
        this.cachedSolPrice = 150; // Default fallback
      }
    }
  }

  // ==================== Fallback ====================

  private setFallbackRate() {
    this.cachedRate = this.getFallbackRate();
  }

  private getFallbackRate(): FortuneRate {
    // Fallback: 1 USD = 10 FORTUNE (0.1 USD per FORTUNE)
    return {
      priceInSol: 0.000667, // ~$0.10 at $150/SOL
      priceInUsd: 0.1,
      marketCapSol: 667, // ~$100k market cap
      marketCapUsd: 100000,
      solPriceUsd: this.cachedSolPrice || 150,
      updatedAt: new Date(),
    };
  }
}
