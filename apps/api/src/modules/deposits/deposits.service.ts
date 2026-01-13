import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { AddressGeneratorService } from './services/address-generator.service';
import { HeliusWebhookService } from './services/helius-webhook.service';
import { DepositProcessorService } from './services/deposit-processor.service';
import { PriceOracleService } from './services/price-oracle.service';
import {
  InitiateDepositDto,
  InitiateDepositResponseDto,
  DepositAddressResponseDto,
  ParsedDeposit,
  HeliusWebhookPayload,
} from './dto';
import {
  Deposit,
  DepositAddress,
  DepositMethod,
  DepositStatus,
  WalletConnection,
} from '@prisma/client';
import { nanoid } from 'nanoid';
import * as QRCode from 'qrcode';
import { MIN_DEPOSIT } from './constants/tokens';

@Injectable()
export class DepositsService {
  private readonly logger = new Logger(DepositsService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    private addressGenerator: AddressGeneratorService,
    private heliusWebhook: HeliusWebhookService,
    private depositProcessor: DepositProcessorService,
    private priceOracle: PriceOracleService,
  ) {}

  // ============== WALLET CONNECT ==============

  /**
   * Connect/update user wallet
   */
  async connectWallet(
    userId: string,
    walletAddress: string,
  ): Promise<WalletConnection> {
    return this.prisma.walletConnection.upsert({
      where: { userId_chain: { userId, chain: 'solana' } },
      update: { walletAddress, connectedAt: new Date() },
      create: { userId, chain: 'solana', walletAddress },
    });
  }

  /**
   * Get user's connected wallet
   */
  async getConnectedWallet(userId: string): Promise<WalletConnection | null> {
    return this.prisma.walletConnection.findUnique({
      where: { userId_chain: { userId, chain: 'solana' } },
    });
  }

  /**
   * Initiate wallet connect deposit
   * Creates pending deposit and returns info for frontend to build transaction
   */
  async initiateWalletDeposit(
    userId: string,
    dto: InitiateDepositDto,
  ): Promise<InitiateDepositResponseDto> {
    const { currency, amount, walletAddress } = dto;

    // Validate minimum amount
    const minAmount = MIN_DEPOSIT[currency];
    if (amount < minAmount) {
      throw new BadRequestException(
        `Minimum deposit for ${currency} is ${minAmount}`,
      );
    }

    // Get hot wallet address
    const hotWallet = this.config.get<string>('SOLANA_HOT_WALLET');
    if (!hotWallet) {
      throw new BadRequestException('Deposits are not configured');
    }

    // Generate unique memo for identifying this deposit
    const memo = nanoid(16);

    // Save wallet connection
    await this.connectWallet(userId, walletAddress);

    // Create pending deposit
    const deposit = await this.prisma.deposit.create({
      data: {
        userId,
        method: DepositMethod.wallet_connect,
        chain: 'solana',
        currency,
        amount,
        memo,
        txSignature: `pending_${memo}`, // Placeholder, updated on confirm
        status: DepositStatus.pending,
      },
    });

    this.logger.log(
      `Initiated wallet deposit: ${deposit.id}, ${amount} ${currency}, memo: ${memo}`,
    );

    return {
      depositId: deposit.id,
      memo,
      recipientAddress: hotWallet,
      amount,
      currency,
    };
  }

  /**
   * Confirm wallet connect deposit after user signs transaction
   */
  async confirmWalletDeposit(
    userId: string,
    depositId: string,
    txSignature: string,
  ): Promise<Deposit> {
    // Find pending deposit
    const deposit = await this.prisma.deposit.findFirst({
      where: {
        id: depositId,
        userId,
        status: DepositStatus.pending,
        method: DepositMethod.wallet_connect,
      },
    });

    if (!deposit) {
      throw new NotFoundException('Pending deposit not found');
    }

    // Check for duplicate signature
    const existing = await this.prisma.deposit.findUnique({
      where: { txSignature },
    });
    if (existing && existing.id !== depositId) {
      throw new ConflictException('Transaction already processed');
    }

    // Update with real signature
    const updated = await this.prisma.deposit.update({
      where: { id: depositId },
      data: { txSignature },
    });

    this.logger.log(
      `Wallet deposit confirmed: ${depositId}, signature: ${txSignature}`,
    );

    // Note: Processing happens via webhook when transaction is confirmed on chain
    return updated;
  }

  // ============== DEPOSIT ADDRESS ==============

  /**
   * Get or create deposit address for user
   */
  async getOrCreateDepositAddress(
    userId: string,
  ): Promise<DepositAddressResponseDto> {
    if (!this.addressGenerator.isConfigured()) {
      throw new BadRequestException('Deposit addresses are not configured');
    }

    let depositAddress = await this.prisma.depositAddress.findUnique({
      where: { userId_chain: { userId, chain: 'solana' } },
    });

    if (!depositAddress) {
      depositAddress = await this.createDepositAddress(userId);
    }

    // Generate QR code
    const qrCode = await this.generateQRCode(depositAddress.address);

    return {
      address: depositAddress.address,
      qrCode,
      minDeposit: MIN_DEPOSIT.SOL,
    };
  }

  /**
   * Create new deposit address for user
   */
  private async createDepositAddress(userId: string): Promise<DepositAddress> {
    // Get next derivation index
    const lastAddress = await this.prisma.depositAddress.findFirst({
      where: { chain: 'solana' },
      orderBy: { derivationIndex: 'desc' },
    });
    const derivationIndex = (lastAddress?.derivationIndex ?? -1) + 1;

    // Generate address
    const { publicKey } =
      this.addressGenerator.generateDepositAddress(derivationIndex);

    // Create record
    const depositAddress = await this.prisma.depositAddress.create({
      data: {
        userId,
        chain: 'solana',
        address: publicKey,
        derivationIndex,
      },
    });

    // Register in Helius webhook
    if (this.heliusWebhook.isConfigured()) {
      try {
        const webhookId = await this.heliusWebhook.registerAddress(publicKey);
        await this.prisma.depositAddress.update({
          where: { id: depositAddress.id },
          data: { webhookId },
        });
      } catch (error) {
        this.logger.error('Failed to register address in Helius', error);
        // Continue anyway - address is still valid
      }
    }

    this.logger.log(
      `Created deposit address for user ${userId}: ${publicKey} (index: ${derivationIndex})`,
    );

    return depositAddress;
  }

  /**
   * Generate QR code for address
   */
  private async generateQRCode(address: string): Promise<string> {
    // Solana URI format
    const uri = `solana:${address}`;
    const qrCode = await QRCode.toDataURL(uri, {
      width: 256,
      margin: 2,
      color: {
        dark: '#000000',
        light: '#ffffff',
      },
    });
    return qrCode;
  }

  // ============== WEBHOOK PROCESSING ==============

  /**
   * Process Helius webhook payload
   */
  async processWebhookPayload(
    payload: HeliusWebhookPayload,
  ): Promise<{ processed: number; skipped: number }> {
    const parsedDeposits = this.heliusWebhook.parseWebhookPayload(payload);

    let processed = 0;
    let skipped = 0;

    for (const parsed of parsedDeposits) {
      try {
        await this.processIncomingDeposit(parsed);
        processed++;
      } catch (error) {
        if (error instanceof ConflictException) {
          skipped++; // Duplicate
        } else {
          this.logger.error('Failed to process deposit', error);
        }
      }
    }

    return { processed, skipped };
  }

  /**
   * Process incoming deposit from webhook
   */
  private async processIncomingDeposit(parsed: ParsedDeposit): Promise<void> {
    // Check for duplicate
    if (await this.depositProcessor.depositExists(parsed.signature)) {
      throw new ConflictException('Deposit already exists');
    }

    // Find associated user
    const userId = await this.findUserForDeposit(parsed);
    if (!userId) {
      this.logger.warn(
        `No user found for deposit to ${parsed.toAddress}, signature: ${parsed.signature}`,
      );
      return;
    }

    // Check if this is a wallet connect deposit waiting for confirmation
    const pendingDeposit = await this.prisma.deposit.findFirst({
      where: {
        userId,
        status: DepositStatus.pending,
        method: DepositMethod.wallet_connect,
      },
    });

    let deposit: Deposit;

    if (pendingDeposit) {
      // Update existing pending deposit
      deposit = await this.prisma.deposit.update({
        where: { id: pendingDeposit.id },
        data: {
          txSignature: parsed.signature,
          amount: parsed.amount,
          currency: parsed.currency,
          slot: parsed.slot,
          status: DepositStatus.confirmed,
          confirmedAt: new Date(),
        },
      });
    } else {
      // Create new deposit (from deposit address)
      deposit = await this.prisma.deposit.create({
        data: {
          userId,
          method: DepositMethod.deposit_address,
          chain: 'solana',
          currency: parsed.currency,
          txSignature: parsed.signature,
          amount: parsed.amount,
          slot: parsed.slot,
          status: DepositStatus.confirmed,
          confirmedAt: new Date(),
        },
      });
    }

    // Process and credit balance
    await this.depositProcessor.processConfirmedDeposit(deposit);

    this.logger.log(
      `Processed deposit: ${parsed.amount} ${parsed.currency} for user ${userId}`,
    );
  }

  /**
   * Find user ID for deposit by address
   */
  private async findUserForDeposit(
    parsed: ParsedDeposit,
  ): Promise<string | null> {
    const hotWallet = this.config.get<string>('SOLANA_HOT_WALLET');

    // If deposit is to hot wallet, check wallet connections
    if (parsed.toAddress === hotWallet) {
      const walletConnection = await this.prisma.walletConnection.findFirst({
        where: { walletAddress: parsed.fromAddress, chain: 'solana' },
      });
      if (walletConnection) {
        return walletConnection.userId;
      }
    }

    // Check deposit addresses
    const depositAddress = await this.prisma.depositAddress.findFirst({
      where: { address: parsed.toAddress, chain: 'solana' },
    });
    if (depositAddress) {
      return depositAddress.userId;
    }

    return null;
  }

  // ============== QUERIES ==============

  /**
   * Get user's deposits
   */
  async getUserDeposits(userId: string): Promise<Deposit[]> {
    return this.prisma.deposit.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Get deposit by ID
   */
  async getDepositById(depositId: string): Promise<Deposit | null> {
    return this.prisma.deposit.findUnique({
      where: { id: depositId },
    });
  }

  /**
   * Get current exchange rates
   */
  async getRates(): Promise<{ sol: number; fortune: number; usdt: number }> {
    return this.priceOracle.getRates();
  }
}
