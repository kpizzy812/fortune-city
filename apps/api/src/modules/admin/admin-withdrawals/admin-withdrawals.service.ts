import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, WithdrawalStatus } from '@prisma/client';
import {
  WithdrawalsFilterDto,
  WithdrawalListItemResponse,
  WithdrawalDetailResponse,
  WithdrawalsListResponse,
  WithdrawalsStatsResponse,
  WithdrawalSortField,
  SortOrder,
  WithdrawalStatusFilter,
} from './dto/withdrawal.dto';

@Injectable()
export class AdminWithdrawalsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of withdrawals with filters
   */
  async getWithdrawals(
    filters: WithdrawalsFilterDto,
  ): Promise<WithdrawalsListResponse> {
    const {
      search,
      status,
      chain,
      method,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = WithdrawalSortField.createdAt,
      sortOrder = SortOrder.desc,
    } = filters;

    // Build where clause
    const where: Prisma.WithdrawalWhereInput = {};

    if (search) {
      where.OR = [
        { walletAddress: { contains: search, mode: 'insensitive' } },
        { txSignature: { contains: search, mode: 'insensitive' } },
        { user: { telegramId: { contains: search } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status && status !== WithdrawalStatusFilter.all) {
      where.status = status as WithdrawalStatus;
    }

    if (chain) {
      where.chain = chain as Prisma.EnumChainFilter;
    }

    if (method) {
      where.method = method as Prisma.EnumWithdrawalMethodFilter;
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = dateFrom;
      }
      if (dateTo) {
        where.createdAt.lte = dateTo;
      }
    }

    // Build orderBy
    const orderBy: Prisma.WithdrawalOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Fetch withdrawals with user info
    const [withdrawals, total] = await Promise.all([
      this.prisma.withdrawal.findMany({
        where,
        orderBy,
        skip: offset,
        take: limit,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              firstName: true,
            },
          },
        },
      }),
      this.prisma.withdrawal.count({ where }),
    ]);

    return {
      withdrawals: withdrawals.map((w) => this.formatWithdrawalListItem(w)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get detailed withdrawal information
   */
  async getWithdrawalById(id: string): Promise<WithdrawalDetailResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            fortuneBalance: true,
            maxTierReached: true,
            isBanned: true,
          },
        },
      },
    });

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal ${id} not found`);
    }

    return this.formatWithdrawalDetail(withdrawal);
  }

  /**
   * Approve a pending withdrawal (mark as processing)
   */
  async approveWithdrawal(
    id: string,
    note?: string,
  ): Promise<WithdrawalDetailResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal ${id} not found`);
    }

    if (withdrawal.status !== 'pending') {
      throw new BadRequestException(
        `Cannot approve withdrawal with status ${withdrawal.status}`,
      );
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'processing',
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            fortuneBalance: true,
            maxTierReached: true,
            isBanned: true,
          },
        },
      },
    });

    // Log action
    await this.logAction(
      'withdrawal_approved',
      'withdrawal',
      id,
      { status: 'pending' },
      { status: 'processing', note },
    );

    return this.formatWithdrawalDetail(updated);
  }

  /**
   * Mark withdrawal as completed with tx signature
   */
  async completeWithdrawal(
    id: string,
    txSignature: string,
    note?: string,
  ): Promise<WithdrawalDetailResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
    });

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal ${id} not found`);
    }

    if (withdrawal.status !== 'processing' && withdrawal.status !== 'pending') {
      throw new BadRequestException(
        `Cannot complete withdrawal with status ${withdrawal.status}`,
      );
    }

    const updated = await this.prisma.withdrawal.update({
      where: { id },
      data: {
        status: 'completed',
        txSignature,
        processedAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            telegramId: true,
            username: true,
            firstName: true,
            fortuneBalance: true,
            maxTierReached: true,
            isBanned: true,
          },
        },
      },
    });

    // Log action
    await this.logAction(
      'withdrawal_completed',
      'withdrawal',
      id,
      { status: withdrawal.status },
      { status: 'completed', txSignature, note },
    );

    return this.formatWithdrawalDetail(updated);
  }

  /**
   * Reject a withdrawal and refund balance
   */
  async rejectWithdrawal(
    id: string,
    reason: string,
  ): Promise<WithdrawalDetailResponse> {
    const withdrawal = await this.prisma.withdrawal.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!withdrawal) {
      throw new NotFoundException(`Withdrawal ${id} not found`);
    }

    if (withdrawal.status !== 'pending' && withdrawal.status !== 'processing') {
      throw new BadRequestException(
        `Cannot reject withdrawal with status ${withdrawal.status}`,
      );
    }

    // Refund the requested amount back to user's balance
    const updated = await this.prisma.$transaction(async (tx) => {
      // Refund user balance
      await tx.user.update({
        where: { id: withdrawal.userId },
        data: {
          fortuneBalance: {
            increment: withdrawal.requestedAmount,
          },
          // Restore fund source tracking
          totalFreshDeposits: {
            increment: withdrawal.fromFreshDeposit,
          },
          totalProfitCollected: {
            increment: withdrawal.fromProfit,
          },
        },
      });

      // Update withdrawal status
      return tx.withdrawal.update({
        where: { id },
        data: {
          status: 'cancelled',
          errorMessage: reason,
          processedAt: new Date(),
        },
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              username: true,
              firstName: true,
              fortuneBalance: true,
              maxTierReached: true,
              isBanned: true,
            },
          },
        },
      });
    });

    // Log action
    await this.logAction(
      'withdrawal_rejected',
      'withdrawal',
      id,
      { status: withdrawal.status },
      {
        status: 'cancelled',
        reason,
        refundedAmount: Number(withdrawal.requestedAmount),
      },
    );

    return this.formatWithdrawalDetail(updated);
  }

  /**
   * Get withdrawals statistics
   */
  async getStats(): Promise<WithdrawalsStatsResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalWithdrawals,
      pendingCount,
      processingCount,
      completedCount,
      failedCount,
      cancelledCount,
      completedStats,
      todayStats,
    ] = await Promise.all([
      this.prisma.withdrawal.count(),
      this.prisma.withdrawal.count({ where: { status: 'pending' } }),
      this.prisma.withdrawal.count({ where: { status: 'processing' } }),
      this.prisma.withdrawal.count({ where: { status: 'completed' } }),
      this.prisma.withdrawal.count({ where: { status: 'failed' } }),
      this.prisma.withdrawal.count({ where: { status: 'cancelled' } }),
      this.prisma.withdrawal.aggregate({
        where: { status: 'completed' },
        _sum: {
          requestedAmount: true,
          netAmount: true,
          taxAmount: true,
        },
      }),
      this.prisma.withdrawal.aggregate({
        where: {
          status: 'completed',
          createdAt: { gte: today },
        },
        _count: true,
        _sum: { netAmount: true },
      }),
    ]);

    return {
      totalWithdrawals,
      pendingCount,
      processingCount,
      completedCount,
      failedCount,
      cancelledCount,
      totalRequestedAmount: Number(completedStats._sum.requestedAmount || 0),
      totalNetAmount: Number(completedStats._sum.netAmount || 0),
      totalTaxCollected: Number(completedStats._sum.taxAmount || 0),
      todayCount: todayStats._count,
      todayAmount: Number(todayStats._sum.netAmount || 0),
    };
  }

  // ============================================
  // Private helpers
  // ============================================

  private formatWithdrawalListItem(withdrawal: {
    id: string;
    method: string;
    chain: string;
    currency: string;
    walletAddress: string;
    requestedAmount: Prisma.Decimal;
    fromFreshDeposit: Prisma.Decimal;
    fromProfit: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    netAmount: Prisma.Decimal;
    usdtAmount: Prisma.Decimal;
    feeSolAmount: Prisma.Decimal | null;
    txSignature: string | null;
    status: string;
    errorMessage: string | null;
    processedAt: Date | null;
    createdAt: Date;
    user: {
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string | null;
    };
  }): WithdrawalListItemResponse {
    return {
      id: withdrawal.id,
      user: {
        id: withdrawal.user.id,
        telegramId: withdrawal.user.telegramId,
        username: withdrawal.user.username,
        firstName: withdrawal.user.firstName,
      },
      method: withdrawal.method,
      chain: withdrawal.chain,
      currency: withdrawal.currency,
      walletAddress: withdrawal.walletAddress,
      requestedAmount: Number(withdrawal.requestedAmount),
      fromFreshDeposit: Number(withdrawal.fromFreshDeposit),
      fromProfit: Number(withdrawal.fromProfit),
      taxAmount: Number(withdrawal.taxAmount),
      taxRate: Number(withdrawal.taxRate),
      netAmount: Number(withdrawal.netAmount),
      usdtAmount: Number(withdrawal.usdtAmount),
      feeSolAmount: withdrawal.feeSolAmount
        ? Number(withdrawal.feeSolAmount)
        : null,
      txSignature: withdrawal.txSignature,
      status: withdrawal.status,
      errorMessage: withdrawal.errorMessage,
      processedAt: withdrawal.processedAt?.toISOString() || null,
      createdAt: withdrawal.createdAt.toISOString(),
    };
  }

  private formatWithdrawalDetail(withdrawal: {
    id: string;
    method: string;
    chain: string;
    currency: string;
    walletAddress: string;
    requestedAmount: Prisma.Decimal;
    fromFreshDeposit: Prisma.Decimal;
    fromProfit: Prisma.Decimal;
    taxAmount: Prisma.Decimal;
    taxRate: Prisma.Decimal;
    netAmount: Prisma.Decimal;
    usdtAmount: Prisma.Decimal;
    feeSolAmount: Prisma.Decimal | null;
    txSignature: string | null;
    status: string;
    errorMessage: string | null;
    processedAt: Date | null;
    createdAt: Date;
    user: {
      id: string;
      telegramId: string;
      username: string | null;
      firstName: string | null;
      fortuneBalance: Prisma.Decimal;
      maxTierReached: number;
      isBanned: boolean;
    };
  }): WithdrawalDetailResponse {
    return {
      id: withdrawal.id,
      user: {
        id: withdrawal.user.id,
        telegramId: withdrawal.user.telegramId,
        username: withdrawal.user.username,
        firstName: withdrawal.user.firstName,
        fortuneBalance: Number(withdrawal.user.fortuneBalance),
        maxTierReached: withdrawal.user.maxTierReached,
        isBanned: withdrawal.user.isBanned,
      },
      method: withdrawal.method,
      chain: withdrawal.chain,
      currency: withdrawal.currency,
      walletAddress: withdrawal.walletAddress,
      requestedAmount: Number(withdrawal.requestedAmount),
      fromFreshDeposit: Number(withdrawal.fromFreshDeposit),
      fromProfit: Number(withdrawal.fromProfit),
      taxAmount: Number(withdrawal.taxAmount),
      taxRate: Number(withdrawal.taxRate),
      netAmount: Number(withdrawal.netAmount),
      usdtAmount: Number(withdrawal.usdtAmount),
      feeSolAmount: withdrawal.feeSolAmount
        ? Number(withdrawal.feeSolAmount)
        : null,
      txSignature: withdrawal.txSignature,
      status: withdrawal.status,
      errorMessage: withdrawal.errorMessage,
      processedAt: withdrawal.processedAt?.toISOString() || null,
      createdAt: withdrawal.createdAt.toISOString(),
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
