import { Injectable, Logger, Inject, forwardRef } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PriceOracleService } from './price-oracle.service';
import { DepositsGateway } from '../deposits.gateway';
import {
  Deposit,
  DepositCurrency,
  DepositStatus,
  Prisma,
} from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

type PrismaTransactionClient = Prisma.TransactionClient;

@Injectable()
export class DepositProcessorService {
  private readonly logger = new Logger(DepositProcessorService.name);

  constructor(
    private prisma: PrismaService,
    private priceOracle: PriceOracleService,
    @Inject(forwardRef(() => DepositsGateway))
    private depositsGateway: DepositsGateway,
  ) {}

  /**
   * Process a confirmed deposit
   * Called after transaction is confirmed on chain
   */
  async processConfirmedDeposit(deposit: Deposit): Promise<Deposit> {
    this.logger.log(
      `Processing deposit ${deposit.id}: ${String(deposit.amount)} ${deposit.currency}`,
    );

    // 1. Convert to USD
    const usdAmount = await this.priceOracle.convertToUsd(
      deposit.currency as 'SOL' | 'USDT_SOL' | 'FORTUNE',
      Number(deposit.amount),
    );

    const rateToUsd = this.calculateRateToUsd(
      deposit.currency,
      Number(deposit.amount),
      usdAmount,
    );

    // 2. Atomic transaction: credit balance + update deposit + create transaction record
    const updatedDeposit = await this.prisma.$transaction(async (tx) => {
      // Credit user balance
      const user = await tx.user.update({
        where: { id: deposit.userId },
        data: {
          fortuneBalance: { increment: usdAmount },
          // Track as fresh deposit for tax purposes
          totalFreshDeposits: { increment: usdAmount },
        },
      });

      // Update deposit status
      const updated = await tx.deposit.update({
        where: { id: deposit.id },
        data: {
          status: DepositStatus.credited,
          amountUsd: usdAmount,
          rateToUsd: rateToUsd,
          creditedAt: new Date(),
        },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'deposit',
          amount: usdAmount,
          currency: 'FORTUNE', // Internal currency is always FORTUNE (USD equivalent)
          netAmount: usdAmount,
          taxAmount: 0,
          taxRate: 0,
          fromFreshDeposit: usdAmount,
          fromProfit: 0,
          chain: deposit.chain,
          txHash: deposit.txSignature,
          status: 'completed',
        },
      });

      // Process referral bonus if user has referrer
      if (user.referredById) {
        await this.processReferralBonuses(
          user.referredById,
          deposit.userId,
          usdAmount,
          tx,
        );
      }

      this.logger.log(
        `Deposit ${deposit.id} credited: $${usdAmount} to user ${deposit.userId}`,
      );

      return { updated, newBalance: Number(user.fortuneBalance) };
    });

    // Emit WebSocket event for real-time notification
    this.depositsGateway.emitDepositCredited({
      depositId: updatedDeposit.updated.id,
      userId: deposit.userId,
      amount: Number(deposit.amount),
      currency: deposit.currency,
      amountUsd: usdAmount,
      newBalance: updatedDeposit.newBalance,
      timestamp: new Date().toISOString(),
    });

    return updatedDeposit.updated;
  }

  /**
   * Process referral bonuses for deposit
   * 3-level system: 5%, 3%, 1%
   */
  private async processReferralBonuses(
    referrerId: string,
    depositUserId: string,
    usdAmount: number,
    tx: PrismaTransactionClient,
  ): Promise<void> {
    const REFERRAL_RATES = [0.05, 0.03, 0.01]; // Level 1, 2, 3
    let currentReferrerId: string | null = referrerId;
    let level = 1;

    while (currentReferrerId && level <= 3) {
      const rate = REFERRAL_RATES[level - 1];
      const bonusAmount = usdAmount * rate;

      // Credit referral balance
      await tx.user.update({
        where: { id: currentReferrerId },
        data: {
          referralBalance: { increment: bonusAmount },
        },
      });

      // Record referral bonus
      await tx.referralBonus.create({
        data: {
          receiverId: currentReferrerId,
          sourceId: depositUserId,
          level,
          rate,
          amount: bonusAmount,
          machineId: 'deposit', // Special marker for deposit-triggered bonus
          freshAmount: usdAmount,
        },
      });

      this.logger.debug(
        `Referral bonus L${level}: $${bonusAmount} to ${currentReferrerId}`,
      );

      // Get next level referrer
      const referrer: { referredById: string | null } | null =
        await tx.user.findUnique({
          where: { id: currentReferrerId },
          select: { referredById: true },
        });

      currentReferrerId = referrer?.referredById ?? null;
      level++;
    }
  }

  /**
   * Calculate rate to USD for record keeping
   */
  private calculateRateToUsd(
    currency: DepositCurrency,
    originalAmount: number,
    usdAmount: number,
  ): Decimal {
    if (originalAmount === 0) return new Decimal(0);

    switch (currency) {
      case 'USDT_SOL':
        return new Decimal(1); // 1:1

      default:
        return new Decimal(usdAmount / originalAmount);
    }
  }

  /**
   * Mark deposit as failed
   */
  async markDepositFailed(
    depositId: string,
    errorMessage: string,
  ): Promise<Deposit> {
    return this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        status: DepositStatus.failed,
        errorMessage,
      },
    });
  }

  /**
   * Mark deposit as confirmed (waiting for processing)
   */
  async markDepositConfirmed(
    depositId: string,
    slot: bigint,
  ): Promise<Deposit> {
    return this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        status: DepositStatus.confirmed,
        slot,
        confirmedAt: new Date(),
      },
    });
  }

  /**
   * Find deposit by signature
   */
  async findBySignature(txSignature: string): Promise<Deposit | null> {
    return this.prisma.deposit.findUnique({
      where: { txSignature },
    });
  }

  /**
   * Find deposit by memo (for wallet connect deposits)
   */
  async findByMemo(memo: string): Promise<Deposit | null> {
    return this.prisma.deposit.findFirst({
      where: { memo },
    });
  }

  /**
   * Check if deposit already exists
   */
  async depositExists(txSignature: string): Promise<boolean> {
    const count = await this.prisma.deposit.count({
      where: { txSignature },
    });
    return count > 0;
  }
}
