import {
  Injectable,
  Logger,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { Prisma, FameSource } from '@prisma/client';
import {
  calculateDailyLoginFame,
  getFamePerHour,
  FAME_PER_MANUAL_COLLECT,
} from '@fortune-city/shared';
import {
  FameBalanceResponse,
  FameHistoryResponse,
  DailyLoginResponse,
  UnlockTierResponse,
} from './dto/fame.dto';

@Injectable()
export class FameService {
  private readonly logger = new Logger(FameService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  // ==================== CORE: Earn / Spend ====================

  /**
   * Earn Fame — atomic increment + transaction log.
   * Accepts optional tx for composability with external transactions.
   */
  async earnFame(
    userId: string,
    amount: number,
    source: FameSource,
    opts?: {
      description?: string;
      machineId?: string;
      tx?: Prisma.TransactionClient;
    },
  ): Promise<number> {
    if (amount <= 0) return 0;

    const client = opts?.tx ?? this.prisma;
    const user = await client.user.update({
      where: { id: userId },
      data: {
        fame: { increment: amount },
        totalFameEarned: { increment: amount },
      },
      select: { fame: true },
    });

    await client.fameTransaction.create({
      data: {
        userId,
        amount,
        balanceAfter: user.fame,
        source,
        description: opts?.description,
        machineId: opts?.machineId,
      },
    });

    return user.fame;
  }

  /**
   * Spend Fame — atomic decrement with balance check.
   * Uses WHERE fame >= amount for race-condition safety.
   */
  async spendFame(
    userId: string,
    amount: number,
    source: FameSource,
    opts?: {
      description?: string;
      tx?: Prisma.TransactionClient;
    },
  ): Promise<number> {
    if (amount <= 0) throw new BadRequestException('Amount must be positive');

    const client = opts?.tx ?? this.prisma;

    // Atomic: update only if fame >= amount
    const result = await client.user.updateMany({
      where: { id: userId, fame: { gte: amount } },
      data: { fame: { decrement: amount } },
    });

    if (result.count === 0) {
      throw new BadRequestException('Not enough Fame');
    }

    const user = await client.user.findUniqueOrThrow({
      where: { id: userId },
      select: { fame: true },
    });

    await client.fameTransaction.create({
      data: {
        userId,
        amount: -amount,
        balanceAfter: user.fame,
        source,
        description: opts?.description,
      },
    });

    return user.fame;
  }

  // ==================== Balance & History ====================

  async getBalance(userId: string): Promise<FameBalanceResponse> {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: {
        fame: true,
        totalFameEarned: true,
        loginStreak: true,
        lastLoginDate: true,
        maxTierUnlocked: true,
      },
    });

    return {
      fame: user.fame,
      totalFameEarned: user.totalFameEarned,
      loginStreak: user.loginStreak,
      lastLoginDate: user.lastLoginDate?.toISOString() ?? null,
      maxTierUnlocked: user.maxTierUnlocked,
    };
  }

  async getHistory(
    userId: string,
    page: number = 1,
    limit: number = 20,
  ): Promise<FameHistoryResponse> {
    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * safeLimit;

    const [items, total] = await Promise.all([
      this.prisma.fameTransaction.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: safeLimit,
      }),
      this.prisma.fameTransaction.count({ where: { userId } }),
    ]);

    return {
      items: items.map((item) => ({
        id: item.id,
        amount: item.amount,
        balanceAfter: item.balanceAfter,
        source: item.source,
        description: item.description,
        machineId: item.machineId,
        createdAt: item.createdAt.toISOString(),
      })),
      total,
      page,
      limit: safeLimit,
    };
  }

  // ==================== Daily Login ====================

  async claimDailyLogin(userId: string): Promise<DailyLoginResponse> {
    const now = new Date();
    const todayUTC = this.getUTCDateString(now);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: {
          fame: true,
          loginStreak: true,
          lastLoginDate: true,
        },
      });

      // Check if already claimed today
      if (user.lastLoginDate) {
        const lastDateStr = this.getUTCDateString(user.lastLoginDate);
        if (lastDateStr === todayUTC) {
          throw new ConflictException('Daily login already claimed today');
        }
      }

      // Calculate streak
      let newStreak = 1;
      if (user.lastLoginDate) {
        const yesterdayUTC = this.getUTCDateString(
          new Date(now.getTime() - 24 * 60 * 60 * 1000),
        );
        const lastDateStr = this.getUTCDateString(user.lastLoginDate);
        if (lastDateStr === yesterdayUTC) {
          newStreak = user.loginStreak + 1;
        }
        // else: streak resets to 1
      }

      // Get settings for potential overrides
      const settings = await this.settingsService.getSettings();
      const dailyBase = settings.fameDailyLogin;
      const streakBonusPerDay = settings.fameStreakBonus;
      const streakCap = settings.fameStreakCap;

      const streakBonus = Math.min(
        (newStreak - 1) * streakBonusPerDay,
        streakCap,
      );
      const earned = dailyBase + streakBonus;

      // Update user streak + login date
      await tx.user.update({
        where: { id: userId },
        data: {
          loginStreak: newStreak,
          lastLoginDate: now,
        },
      });

      // Earn Fame
      const totalFame = await this.earnFame(userId, earned, 'daily_login', {
        description: `Day ${newStreak} streak (+${streakBonus} bonus)`,
        tx,
      });

      this.logger.log(
        `Daily login: user=${userId} streak=${newStreak} earned=${earned}`,
      );

      return {
        earned,
        streak: newStreak,
        totalFame,
      };
    });
  }

  // ==================== Tier Unlock ====================

  async unlockTier(userId: string, tier: number): Promise<UnlockTierResponse> {
    if (tier < 2 || tier > 10) {
      throw new BadRequestException('Tier must be between 2 and 10');
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { fame: true, maxTierUnlocked: true },
      });

      // Must unlock sequentially: tier must be exactly maxTierUnlocked + 1
      if (tier !== user.maxTierUnlocked + 1) {
        throw new BadRequestException(
          `Cannot unlock tier ${tier}. Current max unlocked: ${user.maxTierUnlocked}. Next unlock: ${user.maxTierUnlocked + 1}`,
        );
      }

      // Get cost from settings
      const settings = await this.settingsService.getSettings();
      const unlockCosts = settings.fameUnlockCostByTier as Record<
        string,
        number
      >;
      const cost = unlockCosts[String(tier)];
      if (!cost) {
        throw new BadRequestException(
          `No unlock cost defined for tier ${tier}`,
        );
      }

      if (user.fame < cost) {
        throw new BadRequestException(
          `Not enough Fame. Need ${cost}, have ${user.fame}`,
        );
      }

      // Spend Fame
      await this.spendFame(userId, cost, 'tier_unlock', {
        description: `Unlocked tier ${tier}`,
        tx,
      });

      // Update maxTierUnlocked
      const updated = await tx.user.update({
        where: { id: userId },
        data: { maxTierUnlocked: tier },
        select: { fame: true, maxTierUnlocked: true },
      });

      this.logger.log(
        `Tier unlocked: user=${userId} tier=${tier} cost=${cost}`,
      );

      return {
        tier,
        cost,
        maxTierUnlocked: updated.maxTierUnlocked,
        remainingFame: updated.fame,
      };
    });
  }

  // ==================== Machine passive Fame ====================

  /**
   * Calculate and earn passive Fame from a machine since last calculation.
   * Called from collectCoins() inside its transaction.
   */
  async earnMachinePassiveFame(
    userId: string,
    machineId: string,
    machineTier: number,
    lastFameCalculatedAt: Date,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const now = new Date();
    const hoursSinceLast =
      (now.getTime() - lastFameCalculatedAt.getTime()) / (1000 * 60 * 60);

    if (hoursSinceLast < 0.01) return 0; // Skip if less than ~36 seconds

    // Get per-hour rate from settings
    const settings = await this.settingsService.getSettings();
    const perHourByTier = settings.famePerHourByTier as Record<string, number>;
    const perHour =
      perHourByTier[String(machineTier)] ?? getFamePerHour(machineTier);

    const earned = Math.floor(perHour * hoursSinceLast);
    if (earned <= 0) return 0;

    // Update machine tracking
    await tx.machine.update({
      where: { id: machineId },
      data: {
        lastFameCalculatedAt: now,
        fameGenerated: { increment: earned },
      },
    });

    // Earn Fame
    await this.earnFame(userId, earned, 'machine_passive', {
      description: `Tier ${machineTier} passive (${hoursSinceLast.toFixed(1)}h)`,
      machineId,
      tx,
    });

    return earned;
  }

  /**
   * Earn Fame for manual collect (not auto-collect).
   */
  async earnManualCollectFame(
    userId: string,
    machineId: string,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const settings = await this.settingsService.getSettings();
    const amount = settings.famePerManualCollect;

    if (amount <= 0) return 0;

    await this.earnFame(userId, amount, 'manual_collect', {
      description: 'Manual coin collect',
      machineId,
      tx,
    });

    return amount;
  }

  /**
   * Earn Fame for purchasing a machine.
   */
  async earnPurchaseFame(
    userId: string,
    tier: number,
    isUpgrade: boolean,
    tx: Prisma.TransactionClient,
  ): Promise<number> {
    const settings = await this.settingsService.getSettings();
    const purchaseByTier = settings.famePurchaseByTier as Record<
      string,
      number
    >;
    const upgradeMultiplier = settings.fameUpgradeMultiplier;

    const base = purchaseByTier[String(tier)] ?? 0;
    if (base <= 0) return 0;

    const amount = isUpgrade ? base * upgradeMultiplier : base;

    await this.earnFame(userId, amount, 'machine_purchase', {
      description: isUpgrade
        ? `Tier ${tier} upgrade purchase (x${upgradeMultiplier})`
        : `Tier ${tier} purchase`,
      tx,
    });

    return amount;
  }

  // ==================== Helpers ====================

  private getUTCDateString(date: Date): string {
    return date.toISOString().split('T')[0];
  }
}
