import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma, User, ReferralBonus } from '@prisma/client';
import { REFERRAL_RATES, REFERRAL_MAX_LEVELS } from '@fortune-city/shared';
import { NotificationsService } from '../notifications/notifications.service';

export interface ReferralStats {
  totalReferrals: number;
  activeReferrals: number;
  byLevel: {
    level: number;
    count: number;
    earned: number;
  }[];
  totalEarned: number;
  referralBalance: number;
  referralCode: string;
}

export interface ReferralListItem {
  id: string;
  username: string | null;
  firstName: string | null;
  level: number;
  isActive: boolean;
  totalContributed: number;
  joinedAt: Date;
}

export interface ProcessReferralResult {
  bonuses: ReferralBonus[];
  totalDistributed: number;
}

@Injectable()
export class ReferralsService {
  private readonly logger = new Logger(ReferralsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * Process referral bonuses when a machine is purchased
   * Only pays out on fresh_usdt portion of the purchase
   */
  async processReferralBonus(
    userId: string,
    machineId: string,
    freshDepositAmount: Prisma.Decimal,
    tx?: Prisma.TransactionClient,
  ): Promise<ProcessReferralResult> {
    const client = tx || this.prisma;
    const bonuses: ReferralBonus[] = [];
    let totalDistributed = new Prisma.Decimal(0);

    // If no fresh deposit, no referral bonus
    if (freshDepositAmount.lte(0)) {
      return { bonuses: [], totalDistributed: 0 };
    }

    // Get the referral chain (up to 3 levels)
    const referralChain = await this.getReferralChain(userId, client);

    // Process each level
    for (const referrer of referralChain) {
      const rate = REFERRAL_RATES[referrer.level];
      if (!rate) continue;

      const bonusAmount = freshDepositAmount.mul(rate);

      // Create bonus record
      const bonus = await client.referralBonus.create({
        data: {
          receiverId: referrer.userId,
          sourceId: userId,
          level: referrer.level,
          rate: rate,
          amount: bonusAmount,
          machineId,
          freshAmount: freshDepositAmount,
        },
      });

      // Add to referrer's referralBalance
      await client.user.update({
        where: { id: referrer.userId },
        data: {
          referralBalance: {
            increment: bonusAmount,
          },
        },
      });

      bonuses.push(bonus);
      totalDistributed = totalDistributed.add(bonusAmount);
    }

    return {
      bonuses,
      totalDistributed: Number(totalDistributed),
    };
  }

  /**
   * Get the referral chain for a user (up to 3 levels)
   */
  private async getReferralChain(
    userId: string,
    client: Prisma.TransactionClient | PrismaService = this.prisma,
  ): Promise<{ userId: string; level: number }[]> {
    const chain: { userId: string; level: number }[] = [];
    let currentUserId = userId;

    for (let level = 1; level <= REFERRAL_MAX_LEVELS; level++) {
      const user = await client.user.findUnique({
        where: { id: currentUserId },
        select: { referredById: true },
      });

      if (!user?.referredById) break;

      chain.push({ userId: user.referredById, level });
      currentUserId = user.referredById;
    }

    return chain;
  }

  /**
   * Get referral statistics for a user
   */
  async getReferralStats(userId: string): Promise<ReferralStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        referralCode: true,
        referralBalance: true,
      },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    // Get all referrals by level
    const levelStats = await Promise.all(
      [1, 2, 3].map(async (level) => {
        const referrals = await this.getReferralsAtLevel(userId, level);
        const activeReferrals = await this.getActiveReferralsAtLevel(
          userId,
          level,
        );
        const earned = await this.prisma.referralBonus.aggregate({
          where: {
            receiverId: userId,
            level,
          },
          _sum: { amount: true },
        });

        return {
          level,
          count: referrals.length,
          activeCount: activeReferrals.length,
          earned: Number(earned._sum.amount || 0),
        };
      }),
    );

    const totalReferrals = levelStats.reduce((sum, l) => sum + l.count, 0);
    const activeReferrals = levelStats.reduce(
      (sum, l) => sum + l.activeCount,
      0,
    );
    const totalEarned = levelStats.reduce((sum, l) => sum + l.earned, 0);

    return {
      totalReferrals,
      activeReferrals,
      byLevel: levelStats.map((l) => ({
        level: l.level,
        count: l.count,
        earned: l.earned,
      })),
      totalEarned,
      referralBalance: Number(user.referralBalance),
      referralCode: user.referralCode,
    };
  }

  /**
   * Get direct referrals at a specific level
   */
  private async getReferralsAtLevel(
    userId: string,
    level: number,
  ): Promise<User[]> {
    if (level === 1) {
      return this.prisma.user.findMany({
        where: { referredById: userId },
      });
    }

    // For level 2 and 3, we need to traverse the tree
    const previousLevel = await this.getReferralsAtLevel(userId, level - 1);
    const referrals: User[] = [];

    for (const ref of previousLevel) {
      const nextLevel = await this.prisma.user.findMany({
        where: { referredById: ref.id },
      });
      referrals.push(...nextLevel);
    }

    return referrals;
  }

  /**
   * Get active referrals at a specific level
   * Active = has at least one machine purchased with fresh_usdt
   */
  private async getActiveReferralsAtLevel(
    userId: string,
    level: number,
  ): Promise<User[]> {
    const allReferrals = await this.getReferralsAtLevel(userId, level);

    const activeReferrals: User[] = [];
    for (const ref of allReferrals) {
      const hasActiveMachine = await this.hasActiveMachineWithFreshDeposit(
        ref.id,
      );
      if (hasActiveMachine) {
        activeReferrals.push(ref);
      }
    }

    return activeReferrals;
  }

  /**
   * Get total count of active referrals across all levels (L1+L2+L3)
   * Lightweight version of getReferralStats — returns only the count
   */
  async getActiveReferralCount(userId: string): Promise<number> {
    const counts = await Promise.all(
      [1, 2, 3].map(async (level) => {
        const refs = await this.getActiveReferralsAtLevel(userId, level);
        return refs.length;
      }),
    );
    return counts.reduce((sum, c) => sum + c, 0);
  }

  /**
   * Check if user has at least one machine purchased with fresh deposit
   */
  async hasActiveMachineWithFreshDeposit(userId: string): Promise<boolean> {
    const machine = await this.prisma.machine.findFirst({
      where: {
        userId,
        fundSource: {
          freshDepositAmount: { gt: 0 },
        },
      },
      include: { fundSource: true },
    });

    return !!machine;
  }

  /**
   * Get list of referrals for a user
   */
  async getReferralList(
    userId: string,
    options?: { limit?: number; offset?: number },
  ): Promise<ReferralListItem[]> {
    const limit = options?.limit ?? 50;
    const offset = options?.offset ?? 0;

    // Get level 1 referrals first (direct)
    const directReferrals = await this.prisma.user.findMany({
      where: { referredById: userId },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'desc' },
    });

    const result: ReferralListItem[] = [];

    for (const ref of directReferrals) {
      const isActive = await this.hasActiveMachineWithFreshDeposit(ref.id);
      const totalContributed = await this.prisma.referralBonus.aggregate({
        where: {
          receiverId: userId,
          sourceId: ref.id,
        },
        _sum: { amount: true },
      });

      result.push({
        id: ref.id,
        username: ref.username,
        firstName: ref.firstName,
        level: 1,
        isActive,
        totalContributed: Number(totalContributed._sum.amount || 0),
        joinedAt: ref.createdAt,
      });
    }

    return result;
  }

  /**
   * Check if user can withdraw referral balance
   * Requires at least one active machine
   */
  async canWithdrawReferralBalance(userId: string): Promise<boolean> {
    const activeMachine = await this.prisma.machine.findFirst({
      where: {
        userId,
        status: 'active',
      },
    });

    return !!activeMachine;
  }

  /**
   * Withdraw referral balance to fortune balance
   */
  async withdrawReferralBalance(
    userId: string,
    amount?: number,
  ): Promise<User> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new BadRequestException('User not found');
    }

    const canWithdraw = await this.canWithdrawReferralBalance(userId);
    if (!canWithdraw) {
      throw new BadRequestException(
        'You need at least one active machine to withdraw referral balance',
      );
    }

    const withdrawAmount = amount
      ? new Prisma.Decimal(amount)
      : user.referralBalance;

    if (withdrawAmount.gt(user.referralBalance)) {
      throw new BadRequestException('Insufficient referral balance');
    }

    if (withdrawAmount.lte(0)) {
      throw new BadRequestException('Nothing to withdraw');
    }

    // Transfer from referralBalance to fortuneBalance
    return this.prisma.user.update({
      where: { id: userId },
      data: {
        referralBalance: { decrement: withdrawAmount },
        fortuneBalance: { increment: withdrawAmount },
      },
    });
  }

  /**
   * Find user by referral code
   */
  async findByReferralCode(code: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: { referralCode: code },
    });
  }

  /**
   * Set referrer for a user (called during registration)
   */
  async setReferrer(userId: string, referralCode: string): Promise<User> {
    const referrer = await this.findByReferralCode(referralCode);

    if (!referrer) {
      throw new BadRequestException('Invalid referral code');
    }

    if (referrer.id === userId) {
      throw new BadRequestException('Cannot refer yourself');
    }

    // Check if already has a referrer
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (user?.referredById) {
      throw new BadRequestException('Referrer already set');
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { referredById: referrer.id },
    });

    // Notify referrer about new referral (non-blocking)
    const referralName = user?.firstName || user?.username || 'Someone';
    const { title, message } = NotificationsService.formatNotification(
      'referral_joined',
      { referralName, bonusPercent: REFERRAL_RATES[1] * 100 },
    );

    this.notificationsService
      .notify({
        userId: referrer.id,
        type: 'referral_joined',
        title,
        message,
        data: { referralName, bonusPercent: REFERRAL_RATES[1] * 100 },
      })
      .catch((err) =>
        this.logger.error(
          `Failed to notify referral_joined for referrer ${referrer.id}`,
          err,
        ),
      );

    return updated;
  }
}
