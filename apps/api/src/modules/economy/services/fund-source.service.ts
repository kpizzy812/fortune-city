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

  // TODO: Add user-level tracking for fresh deposits vs profits
  // when implementing detailed income/withdrawal tracking.
  // Methods to add:
  // - recordIncomeCollection(userId, incomeAmount, tx?)
  // - recordFreshDeposit(userId, amount, tx?)
}
