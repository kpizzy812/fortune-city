import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Cron } from '@nestjs/schedule';
import { PublicKey } from '@solana/web3.js';
import { PrismaService } from '../prisma/prisma.service';
import { SolanaRpcService } from '../deposits/services/solana-rpc.service';
import { FundSourceService } from '../economy/services/fund-source.service';
import { TreasuryService } from '../treasury/treasury.service';
import { SOLANA_TOKENS } from '../deposits/constants/tokens';
import {
  CreateWithdrawalDto,
  WithdrawalPreviewResponse,
  PreparedAtomicWithdrawalResponse,
  WithdrawalResponse,
  InstantWithdrawalResponse,
} from './dto';
import { Withdrawal } from '@prisma/client';

// On-chain withdrawal request PDA expiry (seconds)
const WITHDRAWAL_EXPIRY_SECONDS = 3600; // 1 hour

@Injectable()
export class WithdrawalsService {
  private readonly logger = new Logger(WithdrawalsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly solanaRpc: SolanaRpcService,
    private readonly fundSource: FundSourceService,
    private readonly treasury: TreasuryService,
  ) {}

  /**
   * Preview withdrawal - calculate tax and net amount
   */
  async previewWithdrawal(
    userId: string,
    amount: number,
  ): Promise<WithdrawalPreviewResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        fortuneBalance: true,
        totalFreshDeposits: true,
        totalProfitCollected: true,
        currentTaxRate: true,
        taxDiscount: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const balance = Number(user.fortuneBalance);
    if (amount > balance) {
      throw new BadRequestException('Insufficient balance');
    }

    // Calculate fund source breakdown (profit is taxed, fresh is not)
    const breakdown = this.fundSource.calculateSourceBreakdown(
      user.fortuneBalance,
      user.totalFreshDeposits,
      amount,
    );

    // Apply personal tax discount from referral milestones
    const baseTaxRate = Number(user.currentTaxRate);
    const discount = Number(user.taxDiscount);
    const taxRate = Math.max(0, baseTaxRate - discount);
    // Tax only applies to profit portion
    const taxAmount = breakdown.profitDerived * taxRate;
    const netAmount = amount - taxAmount;

    return {
      requestedAmount: amount,
      fromFreshDeposit: breakdown.freshDeposit,
      fromProfit: breakdown.profitDerived,
      taxRate,
      taxAmount,
      netAmount,
      usdtAmount: netAmount, // 1:1 for USDT
      feeSol: 0, // User pays only Solana network fee for claim tx
    };
  }

  /**
   * Prepare atomic withdrawal via on-chain claim.
   * 1. Deducts balance from user
   * 2. Creates on-chain WithdrawalRequest PDA (authority pays rent ~0.001 SOL)
   * 3. Returns claim info for frontend to build claim_withdrawal tx
   *
   * User then signs claim_withdrawal with their wallet → USDT from vault → user ATA.
   */
  async prepareAtomicWithdrawal(
    userId: string,
    amount: number,
    userWalletAddress: string,
  ): Promise<PreparedAtomicWithdrawalResponse> {
    // Validate user wallet address
    try {
      new PublicKey(userWalletAddress);
    } catch {
      throw new BadRequestException('Invalid wallet address');
    }

    // Treasury must be enabled for on-chain withdrawal
    if (!this.treasury.isEnabled()) {
      throw new BadRequestException('Withdrawal service not configured');
    }

    // Get preview for tax calculation
    const preview = await this.previewWithdrawal(userId, amount);

    // Create withdrawal record (pending) and deduct balance
    const withdrawal = await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { fortuneBalance: { decrement: amount } },
      });

      await this.fundSource.recordWithdrawal(userId, amount, tx);

      return tx.withdrawal.create({
        data: {
          userId,
          method: 'wallet_connect',
          chain: 'solana',
          currency: 'USDT_SOL',
          walletAddress: userWalletAddress,
          requestedAmount: amount,
          fromFreshDeposit: preview.fromFreshDeposit,
          fromProfit: preview.fromProfit,
          taxAmount: preview.taxAmount,
          taxRate: preview.taxRate,
          netAmount: preview.netAmount,
          usdtAmount: preview.usdtAmount,
          status: 'pending',
        },
      });
    });

    // Create transaction record
    await this.prisma.transaction.create({
      data: {
        userId,
        type: 'withdrawal',
        amount,
        currency: 'USDT',
        taxAmount: preview.taxAmount,
        taxRate: preview.taxRate,
        netAmount: preview.netAmount,
        fromFreshDeposit: preview.fromFreshDeposit,
        fromProfit: preview.fromProfit,
        chain: 'solana',
        status: 'pending',
      },
    });

    // Create on-chain WithdrawalRequest PDA
    try {
      await this.treasury.createWithdrawalRequest(
        userWalletAddress,
        preview.usdtAmount,
        WITHDRAWAL_EXPIRY_SECONDS,
      );
    } catch (error) {
      // On-chain PDA creation failed → rollback
      this.logger.error(
        'On-chain withdrawal request failed, rolling back:',
        error,
      );
      await this.rollbackWithdrawal(withdrawal);
      await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'failed',
          errorMessage: 'On-chain request creation failed',
        },
      });
      throw new BadRequestException('Failed to create withdrawal request');
    }

    // Get claim info for frontend
    const claimInfo = this.treasury.getClaimInfo();
    const request = await this.treasury.getWithdrawalRequest(userWalletAddress);

    const expiresAt = request
      ? request.expiresAt
      : new Date(Date.now() + WITHDRAWAL_EXPIRY_SECONDS * 1000).toISOString();

    this.logger.log(
      `Prepared on-chain withdrawal ${withdrawal.id} for user ${userId}: $${amount} → $${preview.netAmount} USDT`,
    );

    return {
      withdrawalId: withdrawal.id,
      claimInfo: {
        ...claimInfo,
        withdrawalRequestPda: request?.pdaAddress || '',
      },
      requestedAmount: amount,
      netAmount: preview.netAmount,
      usdtAmount: preview.usdtAmount,
      taxAmount: preview.taxAmount,
      expiresAt,
      recipientAddress: userWalletAddress,
    };
  }

  /**
   * Confirm atomic withdrawal after user signs and sends transaction.
   * Called by frontend with tx signature.
   */
  async confirmAtomicWithdrawal(
    userId: string,
    withdrawalId: string,
    txSignature: string,
  ): Promise<WithdrawalResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.userId !== userId) {
      throw new BadRequestException('Withdrawal does not belong to user');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Withdrawal already processed');
    }

    // Verify transaction on chain
    const confirmed = await this.solanaRpc.confirmTransaction(
      txSignature,
      'confirmed',
    );

    if (!confirmed) {
      // Transaction failed - rollback
      await this.rollbackWithdrawal(withdrawal);

      const updated = await this.prisma.withdrawal.update({
        where: { id: withdrawalId },
        data: {
          status: 'failed',
          errorMessage: 'Transaction not confirmed',
        },
      });

      return this.mapWithdrawalToResponse(updated);
    }

    // Success - update withdrawal
    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: {
        status: 'completed',
        txSignature,
        processedAt: new Date(),
      },
    });

    // Update transaction record
    await this.prisma.transaction.updateMany({
      where: {
        userId,
        type: 'withdrawal',
        status: 'pending',
      },
      data: {
        status: 'completed',
        txHash: txSignature,
      },
    });

    this.logger.log(
      `Atomic withdrawal ${withdrawalId} completed: ${txSignature}`,
    );

    return this.mapWithdrawalToResponse(updated);
  }

  /**
   * Cancel pending atomic withdrawal.
   * For wallet_connect: only allowed after on-chain PDA expires (prevents double-spend).
   */
  async cancelAtomicWithdrawal(
    userId: string,
    withdrawalId: string,
  ): Promise<WithdrawalResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.userId !== userId) {
      throw new BadRequestException('Withdrawal does not belong to user');
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException('Withdrawal already processed');
    }

    // For wallet_connect: must cancel on-chain PDA first (requires expiry)
    if (withdrawal.method === 'wallet_connect' && this.treasury.isEnabled()) {
      const request = await this.treasury.getWithdrawalRequest(
        withdrawal.walletAddress,
      );

      if (request) {
        const expiresAt = new Date(request.expiresAt).getTime();
        if (Date.now() < expiresAt) {
          throw new BadRequestException(
            `Cannot cancel: on-chain claim is active until ${request.expiresAt}. Claim or wait for auto-expiry.`,
          );
        }

        // PDA expired — cancel on-chain (returns rent to authority)
        try {
          await this.treasury.cancelWithdrawalRequest(withdrawal.walletAddress);
        } catch (error) {
          this.logger.error(
            `On-chain cancel failed for ${withdrawal.walletAddress}:`,
            error,
          );
          throw new BadRequestException(
            'Failed to cancel on-chain withdrawal request',
          );
        }
      }
      // PDA doesn't exist — already cancelled by cron or never created
    }

    // Rollback DB balance
    await this.rollbackWithdrawal(withdrawal);

    const updated = await this.prisma.withdrawal.update({
      where: { id: withdrawalId },
      data: { status: 'cancelled' },
    });

    await this.prisma.transaction.updateMany({
      where: { userId, type: 'withdrawal', status: 'pending' },
      data: { status: 'cancelled' },
    });

    this.logger.log(`Withdrawal ${withdrawalId} cancelled`);

    return this.mapWithdrawalToResponse(updated);
  }

  /**
   * Create instant withdrawal (manual address method).
   * Payout wallet sends USDT directly to specified address.
   */
  async createInstantWithdrawal(
    userId: string,
    dto: CreateWithdrawalDto,
  ): Promise<InstantWithdrawalResponse> {
    const { amount, walletAddress } = dto;

    // Validate address
    let recipientPubkey: PublicKey;
    try {
      recipientPubkey = new PublicKey(walletAddress);
    } catch {
      throw new BadRequestException('Invalid Solana wallet address');
    }

    // Get preview
    const preview = await this.previewWithdrawal(userId, amount);

    // Check payout wallet (separate from hot wallet for security)
    const payoutWallet = this.solanaRpc.getPayoutWalletKeypair();
    if (!payoutWallet) {
      throw new BadRequestException('Withdrawal service not configured');
    }

    // Check payout wallet USDT balance
    const usdtMint =
      this.config.get<string>('USDT_MINT') || SOLANA_TOKENS.USDT.mint;
    const payoutWalletUsdtBalance = await this.solanaRpc.getTokenBalance(
      payoutWallet.publicKey,
      usdtMint,
    );
    const requiredUsdtRaw = Math.floor(
      preview.usdtAmount * Math.pow(10, SOLANA_TOKENS.USDT.decimals),
    );

    if (payoutWalletUsdtBalance < requiredUsdtRaw) {
      throw new BadRequestException('Withdrawal temporarily unavailable');
    }

    // Create withdrawal and send in transaction
    let withdrawal: Withdrawal;
    let txSignature: string;

    try {
      // Deduct balance and create record
      withdrawal = await this.prisma.$transaction(async (tx) => {
        // Deduct from user balance
        await tx.user.update({
          where: { id: userId },
          data: {
            fortuneBalance: { decrement: amount },
          },
        });

        // Update fund trackers
        await this.fundSource.recordWithdrawal(userId, amount, tx);

        // Create withdrawal record
        return tx.withdrawal.create({
          data: {
            userId,
            method: 'manual_address',
            chain: 'solana',
            currency: 'USDT_SOL',
            walletAddress,
            requestedAmount: amount,
            fromFreshDeposit: preview.fromFreshDeposit,
            fromProfit: preview.fromProfit,
            taxAmount: preview.taxAmount,
            taxRate: preview.taxRate,
            netAmount: preview.netAmount,
            usdtAmount: preview.usdtAmount,
            status: 'processing',
          },
        });
      });

      // Release USDT from vault to payout wallet (graceful — skip if disabled/fails)
      await this.tryVaultPayout(preview.usdtAmount);

      // Send USDT from payout wallet
      const usdtMintPubkey = new PublicKey(usdtMint);
      const usdtAmountRaw = Math.floor(
        preview.usdtAmount * Math.pow(10, SOLANA_TOKENS.USDT.decimals),
      );

      txSignature = await this.solanaRpc.transferToken(
        payoutWallet,
        recipientPubkey,
        usdtMintPubkey,
        usdtAmountRaw,
      );

      // Update withdrawal as completed
      await this.prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'completed',
          txSignature,
          processedAt: new Date(),
        },
      });

      // Create transaction record
      await this.prisma.transaction.create({
        data: {
          userId,
          type: 'withdrawal',
          amount,
          currency: 'USDT',
          taxAmount: preview.taxAmount,
          taxRate: preview.taxRate,
          netAmount: preview.netAmount,
          fromFreshDeposit: preview.fromFreshDeposit,
          fromProfit: preview.fromProfit,
          chain: 'solana',
          txHash: txSignature,
          status: 'completed',
        },
      });

      this.logger.log(
        `Instant withdrawal ${withdrawal.id} completed: ${txSignature}`,
      );

      return {
        id: withdrawal.id,
        status: 'completed',
        txSignature,
        requestedAmount: amount,
        netAmount: preview.netAmount,
        usdtAmount: preview.usdtAmount,
      };
    } catch (error) {
      this.logger.error(`Instant withdrawal failed for user ${userId}:`, error);

      // If we already created the withdrawal, rollback
      if (withdrawal!) {
        await this.rollbackWithdrawal(withdrawal);
        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'failed',
            errorMessage:
              error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }

      throw new BadRequestException('Withdrawal failed. Please try again.');
    }
  }

  /**
   * Get user's withdrawal history.
   */
  async getUserWithdrawals(
    userId: string,
    limit = 20,
    offset = 0,
  ): Promise<WithdrawalResponse[]> {
    const withdrawals = await this.prisma.withdrawal.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
    });

    return withdrawals.map((w) => this.mapWithdrawalToResponse(w));
  }

  /**
   * Get single withdrawal by ID.
   */
  async getWithdrawalById(
    userId: string,
    withdrawalId: string,
  ): Promise<WithdrawalResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id: withdrawalId },
    });

    if (!withdrawal) {
      throw new NotFoundException('Withdrawal not found');
    }

    if (withdrawal.userId !== userId) {
      throw new BadRequestException('Withdrawal does not belong to user');
    }

    return this.mapWithdrawalToResponse(withdrawal);
  }

  // ─── Cleanup Cron ────────────────────────────────────────

  /**
   * Every 5 min: find expired wallet_connect withdrawals,
   * cancel on-chain PDA, rollback user balance.
   */
  @Cron('0 */5 * * * *')
  async cleanupExpiredWithdrawals(): Promise<void> {
    if (!this.treasury.isEnabled()) return;

    const expiryCutoff = new Date(
      Date.now() - WITHDRAWAL_EXPIRY_SECONDS * 1000,
    );

    const expired = await this.prisma.withdrawal.findMany({
      where: {
        method: 'wallet_connect',
        status: 'pending',
        createdAt: { lt: expiryCutoff },
      },
    });

    if (expired.length === 0) return;

    this.logger.log(
      `Cleanup cron: found ${expired.length} expired withdrawal(s)`,
    );

    for (const withdrawal of expired) {
      try {
        // Try to cancel on-chain PDA if it still exists
        const request = await this.treasury.getWithdrawalRequest(
          withdrawal.walletAddress,
        );

        if (request) {
          try {
            await this.treasury.cancelWithdrawalRequest(
              withdrawal.walletAddress,
            );
            this.logger.log(
              `Cancelled on-chain PDA for withdrawal ${withdrawal.id}`,
            );
          } catch (error) {
            this.logger.error(
              `Failed to cancel PDA for ${withdrawal.id}:`,
              error,
            );
            continue; // Retry next cycle
          }
        }

        // Rollback user balance
        await this.rollbackWithdrawal(withdrawal);

        await this.prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            status: 'cancelled',
            errorMessage: 'Withdrawal request expired (auto-cancelled)',
          },
        });

        await this.prisma.transaction.updateMany({
          where: {
            userId: withdrawal.userId,
            type: 'withdrawal',
            status: 'pending',
          },
          data: { status: 'cancelled' },
        });

        this.logger.log(`Expired and rolled back withdrawal ${withdrawal.id}`);
      } catch (error) {
        this.logger.error(
          `Cleanup failed for withdrawal ${withdrawal.id}:`,
          error,
        );
      }
    }
  }

  // ─── Helpers ────────────────────────────────────────────

  /**
   * Rollback withdrawal - return funds to user.
   */
  private async rollbackWithdrawal(withdrawal: Withdrawal): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      // Return balance
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          fortuneBalance: { increment: withdrawal.requestedAmount },
          totalFreshDeposits: { increment: withdrawal.fromFreshDeposit },
          totalProfitCollected: { increment: withdrawal.fromProfit },
        },
      });
    });

    this.logger.log(`Rolled back withdrawal ${withdrawal.id}`);
  }

  /**
   * Try to release USDT from vault to payout wallet.
   * Graceful: logs warning and continues if treasury is disabled or fails.
   */
  private async tryVaultPayout(amountUsd: number): Promise<void> {
    if (!this.treasury.isEnabled()) return;

    try {
      await this.treasury.payout(amountUsd);
    } catch (error) {
      this.logger.warn(
        `Vault payout $${amountUsd} failed (proceeding with payout wallet balance):`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  /**
   * Map withdrawal to response DTO.
   */
  private mapWithdrawalToResponse(withdrawal: Withdrawal): WithdrawalResponse {
    return {
      id: withdrawal.id,
      status: withdrawal.status,
      method: withdrawal.method,
      requestedAmount: Number(withdrawal.requestedAmount),
      netAmount: Number(withdrawal.netAmount),
      usdtAmount: Number(withdrawal.usdtAmount),
      taxAmount: Number(withdrawal.taxAmount),
      txSignature: withdrawal.txSignature,
      createdAt: withdrawal.createdAt.toISOString(),
      processedAt: withdrawal.processedAt?.toISOString() || null,
    };
  }
}
