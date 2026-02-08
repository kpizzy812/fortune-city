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
import { FameService } from '../../fame/fame.service';
import {
  getTierConfigOrThrow,
  TAX_RATES_BY_TIER,
  REINVEST_REDUCTION,
  getAutoUnlockThreshold,
  calculateTierUnlockFee,
} from '@fortune-city/shared';

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
    private readonly fameService: FameService,
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

    // Check total balance (bonusFortune + fortuneBalance + referralBalance)
    const totalBalance = user.bonusFortune
      .add(user.fortuneBalance)
      .add(user.referralBalance);
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

    // Check if user already has an active/frozen PAID machine of this tier
    // Free machines don't block purchasing a paid one
    const activeMachineOfSameTier = await this.prisma.machine.findFirst({
      where: {
        userId,
        tier: input.tier,
        isFree: false,
        status: { in: ['active', 'frozen'] },
      },
    });

    if (activeMachineOfSameTier) {
      throw new BadRequestException(
        `You already have an active machine of tier ${input.tier}. Wait for it to expire before buying another.`,
      );
    }

    // Calculate reinvestRound automatically
    // If upgrading to a new tier (higher than ever reached), reset to 1
    // Otherwise, count completed PAID machines of this tier + 1
    // Free machines don't count toward reinvest penalty
    let reinvestRound = 1;
    const isUpgrade = input.tier > user.maxTierReached;

    if (!isUpgrade) {
      const completedMachinesCount = await this.prisma.machine.count({
        where: {
          userId,
          tier: input.tier,
          isFree: false,
          status: {
            in: ['expired', 'sold_early', 'sold_auction', 'sold_pawnshop'],
          },
        },
      });
      reinvestRound = completedMachinesCount + 1;
    }

    // Calculate how much to take from each balance
    // Priority: bonusFortune first → fortuneBalance → referralBalance
    const fromBonusFortune = Prisma.Decimal.min(user.bonusFortune, price);
    const remainingAfterBonus = price.sub(fromBonusFortune);
    const fromFortuneBalance = Prisma.Decimal.min(
      user.fortuneBalance,
      remainingAfterBonus,
    );
    const fromReferralBalance = remainingAfterBonus.sub(fromFortuneBalance);

    // Calculate fund source breakdown (how much is fresh deposit vs profit)
    // Note: referralBalance and bonusFortune are NOT fresh deposit
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
      // 1. Deduct balance from user (bonusFortune → fortuneBalance → referralBalance)
      const deductData: Record<string, unknown> = {};
      if (!fromBonusFortune.isZero()) {
        deductData.bonusFortune = { decrement: fromBonusFortune };
      }
      if (!fromFortuneBalance.isZero()) {
        deductData.fortuneBalance = { decrement: fromFortuneBalance };
      }
      if (!fromReferralBalance.isZero()) {
        deductData.referralBalance = { decrement: fromReferralBalance };
      }

      const updatedUser = await tx.user.update({
        where: { id: userId },
        data: deductData,
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

      // 7. Earn Fame for purchase (x2 if upgrade to new tier)
      await this.fameService.earnPurchaseFame(
        userId,
        input.tier,
        isUpgrade,
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
    bonusFortune: number;
    shortfall: number;
    tierLocked: boolean;
    hasActiveMachine: boolean;
    // Reinvest penalty info
    isUpgrade: boolean;
    nextReinvestRound: number;
    currentProfitReduction: number;
    nextProfitReduction: number;
    // Tier unlock info (v3: auto-unlock by totalFameEarned)
    tierUnlockRequired: boolean;
    autoUnlockThreshold: number | null;
    tierUnlockFee: number | null;
    userTotalFameEarned: number;
  }> {
    const tierConfig = getTierConfigOrThrow(tier);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const bonusFortune = Number(user.bonusFortune);
    const fortuneBalance = Number(user.fortuneBalance);
    const referralBalance = Number(user.referralBalance);
    const totalBalance = bonusFortune + fortuneBalance + referralBalance;
    const price = tierConfig.price;
    const maxGlobalTier = await this.settingsService.getMaxGlobalTier();
    const maxAllowedTier = Math.max(maxGlobalTier, user.maxTierUnlocked);

    // Check if user already has an active/frozen machine of this tier
    // Free machines don't block purchasing a paid one
    const activeMachineOfSameTier = await this.prisma.machine.findFirst({
      where: {
        userId,
        tier,
        isFree: false,
        status: { in: ['active', 'frozen'] },
      },
    });

    // Calculate reinvest penalty info (free machines excluded)
    const isUpgrade = tier > user.maxTierReached;
    let nextReinvestRound = 1;
    let currentProfitReduction = 0;
    let nextProfitReduction = 0;

    if (!isUpgrade) {
      const completedMachinesCount = await this.prisma.machine.count({
        where: {
          userId,
          tier,
          isFree: false,
          status: {
            in: ['expired', 'sold_early', 'sold_auction', 'sold_pawnshop'],
          },
        },
      });
      nextReinvestRound = completedMachinesCount + 1;
      currentProfitReduction =
        (REINVEST_REDUCTION[completedMachinesCount] ?? 0.85) * 100;
      nextProfitReduction =
        (REINVEST_REDUCTION[nextReinvestRound] ?? 0.85) * 100;
    }

    // Tier unlock info (v3: auto-unlock by totalFameEarned or $ purchase)
    const tierUnlockRequired = tier > user.maxTierUnlocked;
    const autoUnlockThreshold = tierUnlockRequired
      ? getAutoUnlockThreshold(tier)
      : null;
    const tierUnlockFee = tierUnlockRequired
      ? calculateTierUnlockFee(tierConfig.price)
      : null;

    return {
      canAfford: totalBalance >= price,
      price,
      currentBalance: totalBalance,
      fortuneBalance,
      referralBalance,
      bonusFortune,
      shortfall: Math.max(0, price - totalBalance),
      tierLocked: tier > maxAllowedTier,
      hasActiveMachine: !!activeMachineOfSameTier,
      isUpgrade,
      nextReinvestRound,
      currentProfitReduction,
      nextProfitReduction,
      tierUnlockRequired,
      autoUnlockThreshold,
      tierUnlockFee,
      userTotalFameEarned: user.totalFameEarned,
    };
  }
}
