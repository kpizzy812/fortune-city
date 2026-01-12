import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Machine, Transaction, User, Prisma } from '@prisma/client';
import { MachinesService } from '../../machines/machines.service';
import { TransactionsService } from './transactions.service';
import { FundSourceService } from './fund-source.service';
import { SettingsService } from '../../settings/settings.service';
import { getTierConfigOrThrow, TAX_RATES_BY_TIER } from '@fortune-city/shared';

export interface PurchaseMachineInput {
  tier: number;
  reinvestRound?: number;
}

export interface PurchaseMachineResult {
  machine: Machine;
  transaction: Transaction;
  user: User;
}

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly transactionsService: TransactionsService,
    private readonly fundSourceService: FundSourceService,
    private readonly settingsService: SettingsService,
  ) {}

  async purchaseMachine(
    userId: string,
    input: PurchaseMachineInput,
  ): Promise<PurchaseMachineResult> {
    const tierConfig = getTierConfigOrThrow(input.tier);
    const price = new Prisma.Decimal(tierConfig.price);

    // Get user and validate
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Check balance
    if (user.fortuneBalance.lt(price)) {
      throw new BadRequestException(
        `Insufficient balance. Need ${tierConfig.price} $FORTUNE, have ${user.fortuneBalance.toString()}`,
      );
    }

    // Validate tier accessibility
    // maxGlobalTier - tiers available to everyone without progression
    // maxTierReached + 1 - next tier unlocked by purchasing previous
    // User can buy: max(maxGlobalTier, maxTierReached + 1)
    const maxGlobalTier = await this.settingsService.getMaxGlobalTier();
    const maxAllowedTier = Math.max(maxGlobalTier, user.maxTierReached + 1);
    if (input.tier > maxAllowedTier) {
      throw new BadRequestException(
        `Tier ${input.tier} is locked. Max available tier: ${maxAllowedTier}`,
      );
    }

    // Calculate fund source breakdown (how much is fresh deposit vs profit)
    // For simplicity in MVP, we consider all balance as potentially mixed
    // In production, we'd track user's fresh deposit amount separately
    const sourceBreakdown = this.fundSourceService.calculateSourceBreakdown(
      user.fortuneBalance,
      user.fortuneBalance, // TODO: Track actual fresh deposits at user level
      price,
    );

    // Execute purchase in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct balance from user
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: {
            decrement: price,
          },
        },
      });

      // 2. Update max tier if this is a new high
      let finalUser = updatedUser;
      if (input.tier > user.maxTierReached) {
        const newTaxRate = TAX_RATES_BY_TIER[input.tier] ?? 0.5;
        finalUser = await tx.user.update({
          where: { id: userId },
          data: {
            maxTierReached: input.tier,
            currentTaxRate: newTaxRate,
          },
        });
      }

      // 3. Create machine
      const machine = await this.machinesService.create(userId, {
        tier: input.tier,
        reinvestRound: input.reinvestRound,
      });

      // 4. Create fund source record
      await this.fundSourceService.create(
        {
          machineId: machine.id,
          freshDepositAmount: sourceBreakdown.freshDeposit,
          profitDerivedAmount: sourceBreakdown.profitDerived,
          sourceMachineIds: [],
        },
        tx,
      );

      // 5. Create transaction record
      const transaction = await this.transactionsService.create(
        {
          userId,
          machineId: machine.id,
          type: 'machine_purchase',
          amount: price,
          currency: 'FORTUNE',
          netAmount: price,
          fromFreshDeposit: sourceBreakdown.freshDeposit,
          fromProfit: sourceBreakdown.profitDerived,
          status: 'completed',
        },
        tx,
      );

      return {
        machine,
        transaction,
        user: finalUser,
      };
    });

    return result;
  }

  /**
   * Get user's purchase history
   */
  async getPurchaseHistory(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<Transaction[]> {
    return this.transactionsService.findByUserId(userId, {
      type: 'machine_purchase',
      ...options,
    });
  }

  /**
   * Check if user can afford a specific tier
   */
  async canAffordTier(
    userId: string,
    tier: number,
  ): Promise<{
    canAfford: boolean;
    price: number;
    currentBalance: number;
    shortfall: number;
    tierLocked: boolean;
  }> {
    const tierConfig = getTierConfigOrThrow(tier);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const balance = Number(user.fortuneBalance);
    const price = tierConfig.price;
    const maxGlobalTier = await this.settingsService.getMaxGlobalTier();
    const maxAllowedTier = Math.max(maxGlobalTier, user.maxTierReached + 1);

    return {
      canAfford: balance >= price,
      price,
      currentBalance: balance,
      shortfall: Math.max(0, price - balance),
      tierLocked: tier > maxAllowedTier,
    };
  }
}
