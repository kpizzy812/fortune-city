import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { FundSource, Prisma } from '@prisma/client';

export interface CreateFundSourceInput {
  machineId: string;
  freshDepositAmount: Prisma.Decimal | number;
  profitDerivedAmount: Prisma.Decimal | number;
  sourceMachineIds?: string[];
}

export interface FundSourceBreakdown {
  freshDeposit: number;
  profitDerived: number;
  totalAmount: number;
  profitPercentage: number;
}

@Injectable()
export class FundSourceService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateFundSourceInput,
    tx?: Prisma.TransactionClient,
  ): Promise<FundSource> {
    const client = tx ?? this.prisma;

    return client.fundSource.create({
      data: {
        machineId: input.machineId,
        freshDepositAmount: input.freshDepositAmount,
        profitDerivedAmount: input.profitDerivedAmount,
        sourceMachineIds: input.sourceMachineIds ?? [],
      },
    });
  }

  async findByMachineId(machineId: string): Promise<FundSource | null> {
    return this.prisma.fundSource.findUnique({
      where: { machineId },
    });
  }

  /**
   * Calculate how much of a given amount comes from fresh deposits vs profits.
   * This is critical for correct taxation on withdrawal.
   *
   * For new users with only USDT deposits, 100% is fresh deposit.
   * For reinvesting users, we track the proportion.
   */
  calculateSourceBreakdown(
    userFortuneBalance: Prisma.Decimal | number,
    userTotalFreshDeposits: Prisma.Decimal | number,
    amountToSpend: Prisma.Decimal | number,
  ): FundSourceBreakdown {
    const balance = new Prisma.Decimal(userFortuneBalance);
    const freshDeposits = new Prisma.Decimal(userTotalFreshDeposits);
    const amount = new Prisma.Decimal(amountToSpend);

    // If balance is 0 or amount is 0, return zeros
    if (balance.isZero() || amount.isZero()) {
      return {
        freshDeposit: 0,
        profitDerived: 0,
        totalAmount: Number(amount),
        profitPercentage: 0,
      };
    }

    // Calculate proportion of fresh deposits in current balance
    // Clamp to [0, 1] to handle edge cases
    const freshRatio = Prisma.Decimal.min(
      Prisma.Decimal.max(freshDeposits.div(balance), new Prisma.Decimal(0)),
      new Prisma.Decimal(1),
    );

    const freshPortion = amount.mul(freshRatio);
    const profitPortion = amount.sub(freshPortion);

    return {
      freshDeposit: Number(freshPortion),
      profitDerived: Number(profitPortion),
      totalAmount: Number(amount),
      profitPercentage: Number(new Prisma.Decimal(1).sub(freshRatio).mul(100)),
    };
  }

  /**
   * Record profit collection from machine income.
   * Updates user's totalProfitCollected tracker.
   */
  async recordProfitCollection(
    userId: string,
    incomeAmount: Prisma.Decimal | number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const amount = new Prisma.Decimal(incomeAmount);

    if (amount.isZero() || amount.isNeg()) return;

    await client.user.update({
      where: { id: userId },
      data: {
        totalProfitCollected: { increment: amount },
      },
    });
  }

  /**
   * Record fresh deposit (USDT → FORTUNE conversion).
   * Updates user's totalFreshDeposits tracker.
   */
  async recordFreshDeposit(
    userId: string,
    amount: Prisma.Decimal | number,
    tx?: Prisma.TransactionClient,
  ): Promise<void> {
    const client = tx ?? this.prisma;
    const depositAmount = new Prisma.Decimal(amount);

    if (depositAmount.isZero() || depositAmount.isNeg()) return;

    await client.user.update({
      where: { id: userId },
      data: {
        totalFreshDeposits: { increment: depositAmount },
      },
    });
  }

  /**
   * When machine is sold (auction/pawnshop), propagate its fund_source back to user balance trackers.
   * The payout amount maintains the same fresh/profit proportion as the original machine purchase.
   */
  async propagateMachineFundSourceToBalance(
    userId: string,
    machineId: string,
    payoutAmount: Prisma.Decimal | number,
    tx?: Prisma.TransactionClient,
  ): Promise<{ freshPortion: Prisma.Decimal; profitPortion: Prisma.Decimal }> {
    const client = tx ?? this.prisma;
    const amount = new Prisma.Decimal(payoutAmount);

    // Get original fund source of the machine
    const fundSource = await client.fundSource.findUnique({
      where: { machineId },
    });

    if (!fundSource) {
      // No fund source tracked - treat entire amount as profit (conservative approach)
      await client.user.update({
        where: { id: userId },
        data: {
          totalProfitCollected: { increment: amount },
        },
      });
      return {
        freshPortion: new Prisma.Decimal(0),
        profitPortion: amount,
      };
    }

    // Calculate proportions based on original fund source
    const totalOriginal = new Prisma.Decimal(fundSource.freshDepositAmount).add(
      new Prisma.Decimal(fundSource.profitDerivedAmount),
    );

    if (totalOriginal.isZero()) {
      // Edge case: no original amount tracked - treat as profit
      await client.user.update({
        where: { id: userId },
        data: {
          totalProfitCollected: { increment: amount },
        },
      });
      return {
        freshPortion: new Prisma.Decimal(0),
        profitPortion: amount,
      };
    }

    // Calculate proportions of payout
    const freshRatio = new Prisma.Decimal(fundSource.freshDepositAmount).div(
      totalOriginal,
    );
    const freshPortion = amount.mul(freshRatio);
    const profitPortion = amount.sub(freshPortion);

    // Update user trackers
    await client.user.update({
      where: { id: userId },
      data: {
        totalFreshDeposits: { increment: freshPortion },
        totalProfitCollected: { increment: profitPortion },
      },
    });

    return { freshPortion, profitPortion };
  }

  /**
   * When user makes a withdrawal, deduct from trackers.
   * Profit is deducted first (taxed at currentTaxRate), then fresh deposits (0% tax).
   * This ensures proper tax collection - profit is always taxed first.
   */
  async recordWithdrawal(
    userId: string,
    amount: Prisma.Decimal | number,
    tx?: Prisma.TransactionClient,
  ): Promise<{ fromFresh: Prisma.Decimal; fromProfit: Prisma.Decimal }> {
    const client = tx ?? this.prisma;
    const withdrawAmount = new Prisma.Decimal(amount);

    // Get current user trackers
    const user = await client.user.findUnique({
      where: { id: userId },
      select: { totalFreshDeposits: true, totalProfitCollected: true },
    });

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const freshAvailable = new Prisma.Decimal(user.totalFreshDeposits);
    const profitAvailable = new Prisma.Decimal(user.totalProfitCollected);

    // Deduct from profit first (taxed), then from fresh (0% tax)
    const fromProfit = Prisma.Decimal.min(withdrawAmount, profitAvailable);
    let fromFresh = withdrawAmount.sub(fromProfit);

    // If not enough fresh either, cap at available
    if (fromFresh.gt(freshAvailable)) {
      fromFresh = freshAvailable;
    }

    // Update trackers
    await client.user.update({
      where: { id: userId },
      data: {
        totalProfitCollected: { decrement: fromProfit },
        totalFreshDeposits: { decrement: fromFresh },
      },
    });

    return { fromFresh, fromProfit };
  }
}
