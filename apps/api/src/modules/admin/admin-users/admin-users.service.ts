import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  UsersFilterDto,
  UserListItemResponse,
  UserDetailResponse,
  UsersListResponse,
  UsersStatsResponse,
  ReferralTreeNode,
  ReferralTreeResponse,
  UserSortField,
  SortOrder,
} from './dto/user.dto';

@Injectable()
export class AdminUsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of users with filters
   */
  async getUsers(filters: UsersFilterDto): Promise<UsersListResponse> {
    const {
      search,
      isBanned,
      hasReferrer,
      minTier,
      maxTier,
      limit = 20,
      offset = 0,
      sortBy = UserSortField.createdAt,
      sortOrder = SortOrder.desc,
    } = filters;

    // Build where clause
    const where: Prisma.UserWhereInput = {};

    if (search) {
      where.OR = [
        { username: { contains: search, mode: 'insensitive' } },
        { firstName: { contains: search, mode: 'insensitive' } },
        { lastName: { contains: search, mode: 'insensitive' } },
        { telegramId: { contains: search } },
        { referralCode: { contains: search, mode: 'insensitive' } },
      ];
    }

    if (isBanned !== undefined) {
      where.isBanned = isBanned;
    }

    if (hasReferrer !== undefined) {
      where.referredById = hasReferrer ? { not: null } : null;
    }

    if (minTier !== undefined) {
      where.maxTierReached = {
        ...(where.maxTierReached as object),
        gte: minTier,
      };
    }

    if (maxTier !== undefined) {
      where.maxTierReached = {
        ...(where.maxTierReached as object),
        lte: maxTier,
      };
    }

    // Build orderBy
    const orderBy: Prisma.UserOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Fetch users with counts
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          _count: {
            select: {
              referrals: true,
              machines: true,
            },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user) => this.formatUserListItem(user)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get detailed user information
   */
  async getUserById(userId: string): Promise<UserDetailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referredBy: {
          select: {
            id: true,
            username: true,
            telegramId: true,
          },
        },
        _count: {
          select: {
            referrals: true,
            machines: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Get detailed stats
    const stats = await this.getUserStats(userId);

    return this.formatUserDetail(user, stats);
  }

  /**
   * Ban a user
   */
  async banUser(userId: string, reason: string): Promise<UserDetailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: reason,
      },
      include: {
        referredBy: {
          select: {
            id: true,
            username: true,
            telegramId: true,
          },
        },
        _count: {
          select: {
            referrals: true,
            machines: true,
          },
        },
      },
    });

    // Log action
    await this.logAction(
      'user_banned',
      'user',
      userId,
      { isBanned: false },
      { isBanned: true, reason },
    );

    const stats = await this.getUserStats(userId);
    return this.formatUserDetail(updated, stats);
  }

  /**
   * Unban a user
   */
  async unbanUser(userId: string, note?: string): Promise<UserDetailResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
      },
      include: {
        referredBy: {
          select: {
            id: true,
            username: true,
            telegramId: true,
          },
        },
        _count: {
          select: {
            referrals: true,
            machines: true,
          },
        },
      },
    });

    // Log action
    await this.logAction(
      'user_unbanned',
      'user',
      userId,
      { isBanned: true },
      { isBanned: false, note },
    );

    const stats = await this.getUserStats(userId);
    return this.formatUserDetail(updated, stats);
  }

  /**
   * Get referral tree for a user (3 levels deep)
   */
  async getReferralTree(userId: string): Promise<ReferralTreeResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        referralCode: true,
      },
    });

    if (!user) {
      throw new NotFoundException(`User ${userId} not found`);
    }

    // Get level 1 referrals (direct)
    const level1 = await this.getReferralsAtLevel(userId, 1);

    // Get level 2 referrals
    const level2Promises = level1.map(async (ref) => {
      const children = await this.getReferralsAtLevel(ref.id, 2);
      return { ...ref, children };
    });
    const level1WithChildren = await Promise.all(level2Promises);

    // Get level 3 referrals
    const treeWithLevel3 = await Promise.all(
      level1WithChildren.map(async (l1) => ({
        ...l1,
        children: await Promise.all(
          (l1.children || []).map(async (l2) => ({
            ...l2,
            children: await this.getReferralsAtLevel(l2.id, 3),
          })),
        ),
      })),
    );

    // Calculate stats
    const stats = {
      level1Count: level1.length,
      level2Count: treeWithLevel3.reduce(
        (acc, l1) => acc + (l1.children?.length || 0),
        0,
      ),
      level3Count: treeWithLevel3.reduce(
        (acc, l1) =>
          acc +
          (l1.children?.reduce(
            (acc2, l2) => acc2 + (l2.children?.length || 0),
            0,
          ) || 0),
        0,
      ),
      totalEarned: await this.getTotalReferralEarnings(userId),
    };

    return {
      user: {
        id: user.id,
        username: user.username,
        referralCode: user.referralCode,
      },
      tree: treeWithLevel3,
      stats,
    };
  }

  /**
   * Get users statistics
   */
  async getStats(): Promise<UsersStatsResponse> {
    const [
      totalUsers,
      bannedUsers,
      usersWithReferrer,
      activeUsersResult,
      tierDistribution,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { isBanned: true } }),
      this.prisma.user.count({ where: { referredById: { not: null } } }),
      this.prisma.user.count({
        where: {
          machines: {
            some: {
              status: 'active',
            },
          },
        },
      }),
      this.prisma.user.groupBy({
        by: ['maxTierReached'],
        _count: true,
      }),
    ]);

    const usersByTier: Record<number, number> = {};
    tierDistribution.forEach((item) => {
      usersByTier[item.maxTierReached] = item._count;
    });

    return {
      totalUsers,
      activeUsers: activeUsersResult,
      bannedUsers,
      usersWithReferrer,
      usersByTier,
    };
  }

  // ============================================
  // Private helpers
  // ============================================

  private async getReferralsAtLevel(
    userId: string,
    level: number,
  ): Promise<ReferralTreeNode[]> {
    const referrals = await this.prisma.user.findMany({
      where: { referredById: userId },
      include: {
        _count: {
          select: { machines: true },
        },
      },
    });

    // Get referral bonuses for each
    const bonuses = await this.prisma.referralBonus.groupBy({
      by: ['sourceId'],
      where: {
        receiverId: userId,
        sourceId: { in: referrals.map((r) => r.id) },
      },
      _sum: { amount: true },
    });

    const bonusMap = new Map(
      bonuses.map((b) => [b.sourceId, Number(b._sum.amount || 0)]),
    );

    return referrals.map((ref) => ({
      id: ref.id,
      telegramId: ref.telegramId,
      username: ref.username,
      firstName: ref.firstName,
      fortuneBalance: Number(ref.fortuneBalance),
      maxTierReached: ref.maxTierReached,
      isBanned: ref.isBanned,
      level,
      totalContributed: bonusMap.get(ref.id) || 0,
      machinesCount: ref._count.machines,
      joinedAt: ref.createdAt.toISOString(),
    }));
  }

  private async getTotalReferralEarnings(userId: string): Promise<number> {
    const result = await this.prisma.referralBonus.aggregate({
      where: { receiverId: userId },
      _sum: { amount: true },
    });
    return Number(result._sum.amount || 0);
  }

  private async getUserStats(userId: string) {
    const [
      depositsAgg,
      withdrawalsAgg,
      machinesPurchased,
      activeMachines,
      expiredMachines,
      referralEarnings,
    ] = await Promise.all([
      this.prisma.deposit.aggregate({
        where: { userId, status: 'credited' },
        _count: true,
        _sum: { amountUsd: true },
      }),
      this.prisma.withdrawal.aggregate({
        where: { userId, status: 'completed' },
        _count: true,
        _sum: { netAmount: true },
      }),
      this.prisma.machine.count({ where: { userId } }),
      this.prisma.machine.count({ where: { userId, status: 'active' } }),
      this.prisma.machine.count({ where: { userId, status: 'expired' } }),
      this.prisma.referralBonus.aggregate({
        where: { receiverId: userId },
        _sum: { amount: true },
      }),
    ]);

    return {
      totalDeposits: depositsAgg._count,
      totalDepositsAmount: Number(depositsAgg._sum.amountUsd || 0),
      totalWithdrawals: withdrawalsAgg._count,
      totalWithdrawalsAmount: Number(withdrawalsAgg._sum.netAmount || 0),
      totalMachinesPurchased: machinesPurchased,
      activeMachines,
      expiredMachines,
      totalReferralEarnings: Number(referralEarnings._sum.amount || 0),
    };
  }

  private formatUserListItem(user: {
    id: string;
    telegramId: string;
    username: string | null;
    firstName: string | null;
    lastName: string | null;
    fortuneBalance: Prisma.Decimal;
    referralBalance: Prisma.Decimal;
    maxTierReached: number;
    maxTierUnlocked: number;
    currentTaxRate: Prisma.Decimal;
    isBanned: boolean;
    bannedAt: Date | null;
    referralCode: string;
    referredById: string | null;
    createdAt: Date;
    _count: {
      referrals: number;
      machines: number;
    };
  }): UserListItemResponse {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fortuneBalance: Number(user.fortuneBalance),
      referralBalance: Number(user.referralBalance),
      maxTierReached: user.maxTierReached,
      maxTierUnlocked: user.maxTierUnlocked,
      currentTaxRate: Number(user.currentTaxRate),
      isBanned: user.isBanned,
      bannedAt: user.bannedAt?.toISOString() || null,
      referralCode: user.referralCode,
      hasReferrer: !!user.referredById,
      referralsCount: user._count.referrals,
      machinesCount: user._count.machines,
      createdAt: user.createdAt.toISOString(),
    };
  }

  private formatUserDetail(
    user: {
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string | null;
      lastName: string | null;
      fortuneBalance: Prisma.Decimal;
      referralBalance: Prisma.Decimal;
      totalFreshDeposits: Prisma.Decimal;
      totalProfitCollected: Prisma.Decimal;
      maxTierReached: number;
      maxTierUnlocked: number;
      currentTaxRate: Prisma.Decimal;
      freeSpinsRemaining: number;
      lastSpinAt: Date | null;
      isBanned: boolean;
      bannedAt: Date | null;
      bannedReason: string | null;
      referralCode: string;
      referredById: string | null;
      createdAt: Date;
      referredBy: {
        id: string;
        username: string | null;
        telegramId: string;
      } | null;
      _count: {
        referrals: number;
        machines: number;
      };
    },
    stats: {
      totalDeposits: number;
      totalDepositsAmount: number;
      totalWithdrawals: number;
      totalWithdrawalsAmount: number;
      totalMachinesPurchased: number;
      activeMachines: number;
      expiredMachines: number;
      totalReferralEarnings: number;
    },
  ): UserDetailResponse {
    return {
      id: user.id,
      telegramId: user.telegramId,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fortuneBalance: Number(user.fortuneBalance),
      referralBalance: Number(user.referralBalance),
      totalFreshDeposits: Number(user.totalFreshDeposits),
      totalProfitCollected: Number(user.totalProfitCollected),
      maxTierReached: user.maxTierReached,
      maxTierUnlocked: user.maxTierUnlocked,
      currentTaxRate: Number(user.currentTaxRate),
      freeSpinsRemaining: user.freeSpinsRemaining,
      lastSpinAt: user.lastSpinAt?.toISOString() || null,
      isBanned: user.isBanned,
      bannedAt: user.bannedAt?.toISOString() || null,
      bannedReason: user.bannedReason,
      referralCode: user.referralCode,
      hasReferrer: !!user.referredById,
      referralsCount: user._count.referrals,
      machinesCount: user._count.machines,
      createdAt: user.createdAt.toISOString(),
      referrer: user.referredBy,
      stats,
    };
  }

  /**
   * Log admin action to audit log
   */
  private async logAction(
    action: string,
    resource: string,
    resourceId: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        adminAction: action,
        resource,
        resourceId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        adminUser: 'admin',
      },
    });
  }
}
