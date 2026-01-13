import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { HeliusWebhookPayload, ParsedDeposit } from '../dto';
import { DepositCurrency } from '@prisma/client';
import { LAMPORTS_PER_SOL, SOLANA_TOKENS } from '../constants/tokens';

interface HeliusWebhookConfig {
  webhookID: string;
  webhookURL: string;
  accountAddresses: string[];
}

@Injectable()
export class HeliusWebhookService implements OnModuleInit {
  private readonly logger = new Logger(HeliusWebhookService.name);
  private readonly apiUrl = 'https://api.helius.xyz/v0';
  private apiKey: string;
  private webhookSecret: string;
  private apiBaseUrl: string;
  private cachedWebhook: HeliusWebhookConfig | null = null;

  // Set of monitored addresses (hot wallet + deposit addresses)
  private monitoredAddresses: Set<string> = new Set();

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {}

  async onModuleInit() {
    this.apiKey = this.config.get<string>('HELIUS_API_KEY') || '';
    this.webhookSecret = this.config.get<string>('HELIUS_WEBHOOK_SECRET') || '';
    this.apiBaseUrl = this.config.get<string>('API_URL') || '';

    if (!this.apiKey) {
      this.logger.warn('HELIUS_API_KEY not configured - webhooks disabled');
      return;
    }

    // Load hot wallet address
    const hotWallet = this.config.get<string>('SOLANA_HOT_WALLET');
    if (hotWallet) {
      this.monitoredAddresses.add(hotWallet);
    }

    // Load existing deposit addresses
    const depositAddresses = await this.prisma.depositAddress.findMany({
      where: { chain: 'solana', isActive: true },
      select: { address: true },
    });
    depositAddresses.forEach((da) => this.monitoredAddresses.add(da.address));

    this.logger.log(
      `Helius webhook service initialized with ${this.monitoredAddresses.size} monitored addresses`,
    );
  }

  /**
   * Check if Helius is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }

  /**
   * Validate webhook auth header
   */
  validateAuthHeader(authHeader: string): boolean {
    if (!this.webhookSecret) return false;
    const expectedToken = `Bearer ${this.webhookSecret}`;
    return authHeader === expectedToken;
  }

  /**
   * Get existing webhook or null
   */
  async getWebhook(): Promise<HeliusWebhookConfig | null> {
    if (this.cachedWebhook) return this.cachedWebhook;

    try {
      const response = await fetch(
        `${this.apiUrl}/webhooks?api-key=${this.apiKey}`,
      );
      const webhooks = (await response.json()) as HeliusWebhookConfig[];

      // Find our webhook by URL
      const ourWebhook = webhooks.find((w) =>
        w.webhookURL.includes('/webhooks/helius'),
      );

      if (ourWebhook) {
        this.cachedWebhook = ourWebhook;
      }

      return ourWebhook || null;
    } catch (error) {
      this.logger.error('Failed to get webhooks from Helius', error);
      return null;
    }
  }

  /**
   * Register address for monitoring via Helius webhook
   */
  async registerAddress(address: string): Promise<string> {
    this.monitoredAddresses.add(address);

    const existingWebhook = await this.getWebhook();

    if (existingWebhook) {
      // Add address to existing webhook
      await this.addAddressToWebhook(existingWebhook.webhookID, address);
      return existingWebhook.webhookID;
    }

    // Create new webhook
    const webhookId = await this.createWebhook([address]);
    return webhookId;
  }

  /**
   * Create new Helius webhook
   */
  private async createWebhook(addresses: string[]): Promise<string> {
    const response = await fetch(
      `${this.apiUrl}/webhooks?api-key=${this.apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookURL: `${this.apiBaseUrl}/webhooks/helius`,
          transactionTypes: ['TRANSFER', 'ANY'],
          accountAddresses: addresses,
          webhookType: 'enhanced',
          authHeader: `Bearer ${this.webhookSecret}`,
          txnStatus: 'all',
          encoding: 'jsonParsed',
        }),
      },
    );

    const data = (await response.json()) as HeliusWebhookConfig;

    if (!response.ok) {
      this.logger.error('Failed to create webhook', data);
      throw new Error(`Failed to create webhook: ${JSON.stringify(data)}`);
    }

    this.cachedWebhook = data;
    this.logger.log(`Created Helius webhook: ${data.webhookID}`);

    return data.webhookID;
  }

  /**
   * Add address to existing webhook
   */
  async addAddressToWebhook(webhookId: string, address: string): Promise<void> {
    // Get current addresses
    const webhook = await this.getWebhook();
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    const updatedAddresses = [
      ...new Set([...webhook.accountAddresses, address]),
    ];

    const response = await fetch(
      `${this.apiUrl}/webhooks/${webhookId}?api-key=${this.apiKey}`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accountAddresses: updatedAddresses,
        }),
      },
    );

    if (!response.ok) {
      const errorData = (await response.json()) as unknown;
      this.logger.error('Failed to add address to webhook', errorData);
      throw new Error(`Failed to update webhook: ${JSON.stringify(errorData)}`);
    }

    // Update cache
    if (this.cachedWebhook) {
      this.cachedWebhook.accountAddresses = updatedAddresses;
    }

    this.logger.log(`Added address ${address} to webhook ${webhookId}`);
  }

  /**
   * Check if address is one of our monitored addresses
   */
  isOurAddress(address: string): boolean {
    return this.monitoredAddresses.has(address);
  }

  /**
   * Get currency from mint address
   * USDT: fixed mainnet address
   * FORTUNE: from .env FORTUNE_MINT_ADDRESS
   */
  getCurrencyFromMint(mint: string): DepositCurrency | null {
    // USDT has fixed mainnet address
    if (mint === SOLANA_TOKENS.USDT.mint) {
      return DepositCurrency.USDT_SOL;
    }

    // FORTUNE mint from env
    const fortuneMint = this.config.get<string>('FORTUNE_MINT_ADDRESS');
    if (fortuneMint && mint === fortuneMint) {
      return DepositCurrency.FORTUNE;
    }

    return null;
  }

  /**
   * Parse Helius Enhanced Webhook payload into deposits
   */
  parseWebhookPayload(payload: HeliusWebhookPayload): ParsedDeposit[] {
    const deposits: ParsedDeposit[] = [];

    for (const tx of payload) {
      // Parse SOL transfers
      if (tx.nativeTransfers && tx.nativeTransfers.length > 0) {
        for (const transfer of tx.nativeTransfers) {
          if (this.isOurAddress(transfer.toUserAccount)) {
            deposits.push({
              currency: DepositCurrency.SOL,
              amount: transfer.amount / LAMPORTS_PER_SOL,
              toAddress: transfer.toUserAccount,
              fromAddress: transfer.fromUserAccount,
              signature: tx.signature,
              slot: tx.slot,
            });
          }
        }
      }

      // Parse SPL Token transfers
      if (tx.tokenTransfers && tx.tokenTransfers.length > 0) {
        for (const transfer of tx.tokenTransfers) {
          if (this.isOurAddress(transfer.toUserAccount)) {
            const currency = this.getCurrencyFromMint(transfer.mint);
            if (currency) {
              deposits.push({
                currency,
                amount: transfer.tokenAmount,
                toAddress: transfer.toUserAccount,
                fromAddress: transfer.fromUserAccount,
                signature: tx.signature,
                slot: tx.slot,
                mint: transfer.mint,
              });
            }
          }
        }
      }
    }

    return deposits;
  }
}
