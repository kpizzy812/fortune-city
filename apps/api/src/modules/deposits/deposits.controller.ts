import {
  Controller,
  Get,
  Post,
  Body,
  Headers,
  Param,
  UseGuards,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import type { JwtPayload } from '../auth/auth.service';
import { DepositsService } from './deposits.service';
import { HeliusWebhookService } from './services/helius-webhook.service';
import {
  ConnectWalletDto,
  InitiateDepositDto,
  ConfirmDepositDto,
  InitiateOtherCryptoDepositDto,
} from './dto';
import type { HeliusWebhookPayload } from './dto';
import { OtherCryptoNetwork } from './constants/other-crypto';

@Controller('deposits')
export class DepositsController {
  constructor(private depositsService: DepositsService) {}

  // ============== WALLET CONNECT ==============

  /**
   * POST /deposits/wallet-connect
   * Connect user's Solana wallet
   */
  @Post('wallet-connect')
  @UseGuards(JwtAuthGuard)
  async connectWallet(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConnectWalletDto,
  ): Promise<{ connected: boolean }> {
    await this.depositsService.connectWallet(user.sub, dto.walletAddress);
    return { connected: true };
  }

  /**
   * GET /deposits/wallet
   * Get user's connected wallet
   */
  @Get('wallet')
  @UseGuards(JwtAuthGuard)
  async getConnectedWallet(
    @CurrentUser() user: JwtPayload,
  ): Promise<{ wallet: import('@prisma/client').WalletConnection | null }> {
    const wallet = await this.depositsService.getConnectedWallet(user.sub);
    return { wallet };
  }

  /**
   * POST /deposits/initiate
   * Initiate wallet connect deposit
   * Returns info for frontend to build and sign transaction
   */
  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  async initiateDeposit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiateDepositDto,
  ): Promise<import('./dto').InitiateDepositResponseDto> {
    return this.depositsService.initiateWalletDeposit(user.sub, dto);
  }

  /**
   * POST /deposits/confirm
   * Confirm wallet connect deposit after user signs transaction
   */
  @Post('confirm')
  @UseGuards(JwtAuthGuard)
  async confirmDeposit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: ConfirmDepositDto,
  ): Promise<{ status: import('@prisma/client').DepositStatus }> {
    const deposit = await this.depositsService.confirmWalletDeposit(
      user.sub,
      dto.depositId,
      dto.txSignature,
    );
    return { status: deposit.status };
  }

  // ============== DEPOSIT ADDRESS ==============

  /**
   * GET /deposits/address
   * Get (or generate) deposit address for user
   */
  @Get('address')
  @UseGuards(JwtAuthGuard)
  async getDepositAddress(
    @CurrentUser() user: JwtPayload,
  ): Promise<import('./dto').DepositAddressResponseDto> {
    return this.depositsService.getOrCreateDepositAddress(user.sub);
  }

  // ============== COMMON ==============

  /**
   * GET /deposits
   * Get user's deposit history
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  async getDeposits(
    @CurrentUser() user: JwtPayload,
  ): Promise<import('@prisma/client').Deposit[]> {
    return this.depositsService.getUserDeposits(user.sub);
  }

  /**
   * GET /deposits/rates
   * Get current exchange rates
   */
  @Get('rates')
  async getRates() {
    return this.depositsService.getRates();
  }

  // ============== OTHER CRYPTO ==============

  /**
   * GET /deposits/other-crypto/instructions/:network
   * Get instructions for other crypto deposits (BEP20/TON)
   */
  @Get('other-crypto/instructions/:network')
  async getOtherCryptoInstructions(
    @Param('network') network: OtherCryptoNetwork,
  ): Promise<import('./dto').OtherCryptoInstructionsDto> {
    return this.depositsService.getOtherCryptoInstructions(network);
  }

  /**
   * POST /deposits/other-crypto
   * Initiate other crypto deposit (user claims they sent funds)
   */
  @Post('other-crypto')
  @UseGuards(JwtAuthGuard)
  async initiateOtherCryptoDeposit(
    @CurrentUser() user: JwtPayload,
    @Body() dto: InitiateOtherCryptoDepositDto,
  ): Promise<import('./dto').OtherCryptoDepositResponseDto> {
    return this.depositsService.initiateOtherCryptoDeposit(user.sub, dto);
  }
}

// ============== WEBHOOK CONTROLLER ==============

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private depositsService: DepositsService,
    private heliusWebhook: HeliusWebhookService,
  ) {}

  /**
   * POST /webhooks/helius
   * Helius webhook endpoint for Solana transaction notifications
   * No JWT guard - authenticated via auth header from Helius
   */
  @Post('helius')
  async handleHeliusWebhook(
    @Body() payload: HeliusWebhookPayload,
    @Headers('authorization') authHeader: string,
  ) {
    // Validate webhook auth
    if (!this.heliusWebhook.validateAuthHeader(authHeader)) {
      this.logger.warn('Invalid Helius webhook auth header');
      throw new UnauthorizedException('Invalid webhook authentication');
    }

    this.logger.log(
      `Received Helius webhook with ${Array.isArray(payload) ? payload.length : 1} transactions`,
    );

    // Process webhook
    const result = await this.depositsService.processWebhookPayload(payload);

    this.logger.log(
      `Webhook processed: ${result.processed} deposits, ${result.skipped} skipped`,
    );

    return { received: true, ...result };
  }
}
