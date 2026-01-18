import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, DepositStatus } from '@prisma/client';
import {
  DepositsFilterDto,
  DepositListItemResponse,
  DepositDetailResponse,
  DepositsListResponse,
  DepositsStatsResponse,
  DepositSortField,
  SortOrder,
  DepositStatusFilter,
} from './dto/deposit.dto';

@Injectable()
export class AdminDepositsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of deposits with filters
   */
  async getDeposits(filters: DepositsFilterDto): Promise<DepositsListResponse> {
    const {
      search,
      status,
      chain,
      currency,
      method,
      dateFrom,
      dateTo,
      limit = 20,
      offset = 0,
      sortBy = DepositSortField.createdAt,
      sortOrder = SortOrder.desc,
    } = filters;

    // Build where clause
    const where: Prisma.DepositWhereInput = {};

    if (search) {
      where.OR = [
        { txSignature: { contains: search, mode: 'insensitive' } },
        { memo: { contains: search, mode: 'insensitive' } },
        { user: { telegramId: { contains: search } } },
        { user: { username: { contains: search, mode: 'insensitive' } } },
      ];
    }

    if (status && status !== DepositStatusFilter.all) {
      where.status = status as DepositStatus;
    }

    if (chain) {
      where.chain = chain as Prisma.EnumChainFilter;
    }

    if (currency) {
      where.currency = currency as Prisma.EnumDepositCurrencyFilter;
    }

    if (method) {
      where.method = method as Prisma.EnumDepositMethodFilter;
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
    const orderBy: Prisma.DepositOrderByWithRelationInput = {};
    orderBy[sortBy] = sortOrder;

    // Fetch deposits with user info
    const [deposits, total] = await Promise.all([
      this.prisma.deposit.findMany({
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
      this.prisma.deposit.count({ where }),
    ]);

    return {
      deposits: deposits.map((d) => this.formatDepositListItem(d)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get detailed deposit information
   */
  async getDepositById(id: string): Promise<DepositDetailResponse> {
    const deposit = await this.prisma.deposit.findUnique({
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

    if (!deposit) {
      throw new NotFoundException(`Deposit ${id} not found`);
    }

    return this.formatDepositDetail(deposit);
  }

  /**
   * Manually credit a failed deposit
   */
  async manualCredit(
    id: string,
    reason: string,
  ): Promise<DepositDetailResponse> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id },
      include: { user: true },
    });

    if (!deposit) {
      throw new NotFoundException(`Deposit ${id} not found`);
    }

    if (deposit.status === 'credited') {
      throw new BadRequestException('Deposit already credited');
    }

    // Credit user balance and update deposit status
    const updated = await this.prisma.$transaction(async (tx) => {
      // Credit user balance
      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          fortuneBalance: { increment: deposit.amountUsd },
          totalFreshDeposits: { increment: deposit.amountUsd },
        },
      });

      // Update deposit status
      return tx.deposit.update({
        where: { id },
        data: {
          status: 'credited',
          creditedAt: new Date(),
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
      'deposit_manual_credit',
      'deposit',
      id,
      { status: deposit.status },
      {
        status: 'credited',
        reason,
        creditedAmount: Number(deposit.amountUsd),
      },
    );

    return this.formatDepositDetail(updated);
  }

  /**
   * Retry a failed deposit (mark as pending for reprocessing)
   */
  async retryDeposit(
    id: string,
    note?: string,
  ): Promise<DepositDetailResponse> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id },
    });

    if (!deposit) {
      throw new NotFoundException(`Deposit ${id} not found`);
    }

    if (deposit.status !== 'failed') {
      throw new BadRequestException(
        `Cannot retry deposit with status ${deposit.status}`,
      );
    }

    const updated = await this.prisma.deposit.update({
      where: { id },
      data: {
        status: 'pending',
        errorMessage: null,
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
      'deposit_retry',
      'deposit',
      id,
      { status: 'failed' },
      { status: 'pending', note },
    );

    return this.formatDepositDetail(updated);
  }

  /**
   * Get deposits statistics
   */
  async getStats(): Promise<DepositsStatsResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalDeposits,
      pendingCount,
      confirmedCount,
      creditedCount,
      failedCount,
      creditedStats,
      todayStats,
      byCurrencyRaw,
    ] = await Promise.all([
      this.prisma.deposit.count(),
      this.prisma.deposit.count({ where: { status: 'pending' } }),
      this.prisma.deposit.count({ where: { status: 'confirmed' } }),
      this.prisma.deposit.count({ where: { status: 'credited' } }),
      this.prisma.deposit.count({ where: { status: 'failed' } }),
      this.prisma.deposit.aggregate({
        where: { status: 'credited' },
        _sum: { amountUsd: true },
      }),
      this.prisma.deposit.aggregate({
        where: {
          status: 'credited',
          createdAt: { gte: today },
        },
        _count: true,
        _sum: { amountUsd: true },
      }),
      this.prisma.deposit.groupBy({
        by: ['currency'],
        where: { status: 'credited' },
        _count: true,
        _sum: { amount: true },
      }),
    ]);

    const byCurrency: Record<string, { count: number; amount: number }> = {};
    byCurrencyRaw.forEach((item) => {
      byCurrency[item.currency] = {
        count: item._count,
        amount: Number(item._sum.amount || 0),
      };
    });

    return {
      totalDeposits,
      pendingCount,
      confirmedCount,
      creditedCount,
      failedCount,
      totalAmountUsd: Number(creditedStats._sum.amountUsd || 0),
      todayCount: todayStats._count,
      todayAmountUsd: Number(todayStats._sum.amountUsd || 0),
      byCurrency,
    };
  }

  // ============================================
  // Private helpers
  // ============================================

  private formatDepositListItem(deposit: {
    id: string;
    method: string;
    chain: string;
    currency: string;
    txSignature: string;
    amount: Prisma.Decimal;
    amountUsd: Prisma.Decimal;
    rateToUsd: Prisma.Decimal | null;
    memo: string | null;
    status: string;
    slot: bigint | null;
    confirmedAt: Date | null;
    creditedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    user: {
      id: string;
      telegramId: string | null;
      username: string | null;
      firstName: string | null;
    };
  }): DepositListItemResponse {
    return {
      id: deposit.id,
      user: {
        id: deposit.user.id,
        telegramId: deposit.user.telegramId,
        username: deposit.user.username,
        firstName: deposit.user.firstName,
      },
      method: deposit.method,
      chain: deposit.chain,
      currency: deposit.currency,
      txSignature: deposit.txSignature,
      amount: Number(deposit.amount),
      amountUsd: Number(deposit.amountUsd),
      rateToUsd: deposit.rateToUsd ? Number(deposit.rateToUsd) : null,
      memo: deposit.memo,
      status: deposit.status,
      slot: deposit.slot?.toString() || null,
      confirmedAt: deposit.confirmedAt?.toISOString() || null,
      creditedAt: deposit.creditedAt?.toISOString() || null,
      errorMessage: deposit.errorMessage,
      createdAt: deposit.createdAt.toISOString(),
    };
  }

  private formatDepositDetail(deposit: {
    id: string;
    method: string;
    chain: string;
    currency: string;
    txSignature: string;
    amount: Prisma.Decimal;
    amountUsd: Prisma.Decimal;
    rateToUsd: Prisma.Decimal | null;
    memo: string | null;
    status: string;
    slot: bigint | null;
    confirmedAt: Date | null;
    creditedAt: Date | null;
    errorMessage: string | null;
    createdAt: Date;
    user: {
      id: string;
      telegramId: string | null;
      username: string | null;
      firstName: string | null;
      fortuneBalance: Prisma.Decimal;
      maxTierReached: number;
      isBanned: boolean;
    };
  }): DepositDetailResponse {
    return {
      id: deposit.id,
      user: {
        id: deposit.user.id,
        telegramId: deposit.user.telegramId,
        username: deposit.user.username,
        firstName: deposit.user.firstName,
        fortuneBalance: Number(deposit.user.fortuneBalance),
        maxTierReached: deposit.user.maxTierReached,
        isBanned: deposit.user.isBanned,
      },
      method: deposit.method,
      chain: deposit.chain,
      currency: deposit.currency,
      txSignature: deposit.txSignature,
      amount: Number(deposit.amount),
      amountUsd: Number(deposit.amountUsd),
      rateToUsd: deposit.rateToUsd ? Number(deposit.rateToUsd) : null,
      memo: deposit.memo,
      status: deposit.status,
      slot: deposit.slot?.toString() || null,
      confirmedAt: deposit.confirmedAt?.toISOString() || null,
      creditedAt: deposit.creditedAt?.toISOString() || null,
      errorMessage: deposit.errorMessage,
      createdAt: deposit.createdAt.toISOString(),
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
        oldValue: oldValue
          ? (JSON.parse(JSON.stringify(oldValue)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        newValue: newValue
          ? (JSON.parse(JSON.stringify(newValue)) as Prisma.InputJsonValue)
          : Prisma.JsonNull,
        adminUser: 'admin',
      },
    });
  }
}
