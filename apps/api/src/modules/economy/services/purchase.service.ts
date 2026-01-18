import {
  Injectable,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Machine, Transaction, User, Prisma } from '@prisma/client';
import { MachinesService } from '../../machines/machines.service';
import { AuctionService } from '../../machines/services/auction.service';
import { TransactionsService } from './transactions.service';
import { FundSourceService } from './fund-source.service';
import { SettingsService } from '../../settings/settings.service';
import { ReferralsService } from '../../referrals/referrals.service';
import { getTierConfigOrThrow, TAX_RATES_BY_TIER } from '@fortune-city/shared';

export interface PurchaseMachineInput {
  tier: number;
  // reinvestRound is calculated automatically based on user's history
}

export interface PurchaseMachineResult {
  machine: Machine;
  transaction: Transaction;
  user: User;
  fromAuction?: {
    sellerId: string;
    sellerPayout: number;
    upgrades: {
      coinBoxLevel: number;
      fortuneGambleLevel: number;
      autoCollect: boolean;
    };
  };
}

@Injectable()
export class PurchaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly machinesService: MachinesService,
    private readonly auctionService: AuctionService,
    private readonly transactionsService: TransactionsService,
    private readonly fundSourceService: FundSourceService,
    private readonly settingsService: SettingsService,
    private readonly referralsService: ReferralsService,
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

    // Check total balance (fortuneBalance + referralBalance)
    const totalBalance = user.fortuneBalance.add(user.referralBalance);
    if (totalBalance.lt(price)) {
      throw new BadRequestException(
        `Insufficient balance. Need ${tierConfig.price} $FORTUNE, have ${totalBalance.toString()}`,
      );
    }

    // Validate tier accessibility
    // maxGlobalTier - tiers available to everyone without progression
    // maxTierUnlocked - tier unlocked after machine expired (progression)
    // User can buy: max(maxGlobalTier, maxTierUnlocked)
    const maxGlobalTier = await this.settingsService.getMaxGlobalTier();
    const maxAllowedTier = Math.max(maxGlobalTier, user.maxTierUnlocked);
    if (input.tier > maxAllowedTier) {
      throw new BadRequestException(
        `Tier ${input.tier} is locked. Max available tier: ${maxAllowedTier}`,
      );
    }

    // Check if user already has an active machine of this tier
    // Only one active machine per tier allowed
    const activeMachineOfSameTier = await this.prisma.machine.findFirst({
      where: {
        userId,
        tier: input.tier,
        status: 'active',
      },
    });

    if (activeMachineOfSameTier) {
      throw new BadRequestException(
        `You already have an active machine of tier ${input.tier}. Wait for it to expire before buying another.`,
      );
    }

    // Calculate reinvestRound automatically
    // If upgrading to a new tier (higher than ever reached), reset to 1
    // Otherwise, count completed machines of this tier + 1
    let reinvestRound = 1;
    const isUpgrade = input.tier > user.maxTierReached;

    if (!isUpgrade) {
      // Count completed machines of this tier (not active, not listed)
      const completedMachinesCount = await this.prisma.machine.count({
        where: {
          userId,
          tier: input.tier,
          status: {
            in: ['expired', 'sold_early', 'sold_auction', 'sold_pawnshop'],
          },
        },
      });
      reinvestRound = completedMachinesCount + 1;
    }

    // Calculate how much to take from each balance
    // Priority: fortuneBalance first, then referralBalance
    const fromFortuneBalance = Prisma.Decimal.min(user.fortuneBalance, price);
    const fromReferralBalance = price.sub(fromFortuneBalance);

    // Calculate fund source breakdown (how much is fresh deposit vs profit)
    // Note: referralBalance is NOT fresh deposit, so we exclude it from fresh calculation
    // User has totalFreshDeposits field that tracks cumulative fresh USDT deposits
    const sourceBreakdown = this.fundSourceService.calculateSourceBreakdown(
      user.fortuneBalance,
      user.totalFreshDeposits,
      fromFortuneBalance, // Only calculate source for fortuneBalance portion
    );

    // Check if there's a pending auction listing for this tier
    const pendingListing = await this.auctionService.getFirstPendingListing(
      input.tier,
    );

    // Execute purchase in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // 1. Deduct balance from user (both fortuneBalance and referralBalance if needed)
      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: {
          fortuneBalance: { decrement: fromFortuneBalance },
          referralBalance: { decrement: fromReferralBalance },
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

      // 3. Create machine (reinvestRound calculated automatically above)
      const machine = await this.machinesService.create(userId, {
        tier: input.tier,
        reinvestRound,
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

      // 6. Process referral bonuses (only on fresh_usdt portion)
      await this.referralsService.processReferralBonus(
        userId,
        machine.id,
        new Prisma.Decimal(sourceBreakdown.freshDeposit),
        tx,
      );

      return {
        machine,
        transaction,
        user: finalUser,
      };
    });

    // Process auction sale if there was a pending listing
    // This is done outside the main transaction to avoid deadlocks
    let auctionInfo: PurchaseMachineResult['fromAuction'] | undefined;

    if (pendingListing) {
      // Process auction sale (pay seller, update listing status)
      const auctionResult = await this.auctionService.processAuctionSale(
        pendingListing,
        userId,
        result.machine.id,
      );

      // Apply upgrades from seller's machine to buyer's new machine
      await this.auctionService.applyUpgradesToMachine(
        result.machine.id,
        pendingListing,
      );

      auctionInfo = {
        sellerId: pendingListing.sellerId,
        sellerPayout: auctionResult.sellerPayout,
        upgrades: {
          coinBoxLevel: pendingListing.coinBoxLevelAtListing,
          fortuneGambleLevel: pendingListing.fortuneGambleLevelAtListing,
          autoCollect: pendingListing.autoCollectAtListing,
        },
      };

      // Refresh machine data with applied upgrades
      const updatedMachine = await this.machinesService.findByIdOrThrow(
        result.machine.id,
      );
      result.machine = updatedMachine;
    }

    return {
      ...result,
      fromAuction: auctionInfo,
    };
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
    fortuneBalance: number;
    referralBalance: number;
    shortfall: number;
    tierLocked: boolean;
    hasActiveMachine: boolean;
  }> {
    const tierConfig = getTierConfigOrThrow(tier);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const fortuneBalance = Number(user.fortuneBalance);
    const referralBalance = Number(user.referralBalance);
    const totalBalance = fortuneBalance + referralBalance;
    const price = tierConfig.price;
    const maxGlobalTier = await this.settingsService.getMaxGlobalTier();
    const maxAllowedTier = Math.max(maxGlobalTier, user.maxTierUnlocked);

    // Check if user already has an active machine of this tier
    const activeMachineOfSameTier = await this.prisma.machine.findFirst({
      where: {
        userId,
        tier,
        status: 'active',
      },
    });

    return {
      canAfford: totalBalance >= price,
      price,
      currentBalance: totalBalance,
      fortuneBalance,
      referralBalance,
      shortfall: Math.max(0, price - totalBalance),
      tierLocked: tier > maxAllowedTier,
      hasActiveMachine: !!activeMachineOfSameTier,
    };
  }
}
