import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma, DepositStatus, DepositMethod } from '@prisma/client';
import {
  DepositsFilterDto,
  DepositListItemResponse,
  DepositDetailResponse,
  DepositsListResponse,
  DepositsStatsResponse,
  DepositSortField,
  SortOrder,
  DepositStatusFilter,
  ApproveOtherCryptoDepositDto,
  RejectOtherCryptoDepositDto,
} from './dto/deposit.dto';
import { PriceOracleService } from '../../deposits/services/price-oracle.service';
import { DepositsGateway } from '../../deposits/deposits.gateway';
import {
  OtherCryptoToken,
  OtherCryptoNetwork,
} from '../../deposits/constants/other-crypto';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class AdminDepositsService {
  private readonly logger = new Logger(AdminDepositsService.name);
  private readonly botToken: string | undefined;

  constructor(
    private readonly prisma: PrismaService,
    private readonly priceOracle: PriceOracleService,
    private readonly depositsGateway: DepositsGateway,
    private readonly config: ConfigService,
  ) {
    this.botToken = this.config.get<string>('TELEGRAM_BOT_TOKEN');
  }

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
    otherCryptoNetwork?: string | null;
    otherCryptoToken?: string | null;
    claimedAmount?: Prisma.Decimal | null;
    adminNotes?: string | null;
    processedBy?: string | null;
    processedAt?: Date | null;
    rejectionReason?: string | null;
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
      // Other crypto fields
      otherCryptoNetwork: deposit.otherCryptoNetwork,
      otherCryptoToken: deposit.otherCryptoToken,
      claimedAmount: deposit.claimedAmount ? Number(deposit.claimedAmount) : null,
      adminNotes: deposit.adminNotes,
      processedBy: deposit.processedBy,
      processedAt: deposit.processedAt?.toISOString() || null,
      rejectionReason: deposit.rejectionReason,
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

  // ============================================
  // Other Crypto Methods
  // ============================================

  /**
   * Approve other crypto deposit
   */
  async approveOtherCryptoDeposit(
    depositId: string,
    dto: ApproveOtherCryptoDepositDto,
    adminUsername: string,
  ): Promise<DepositDetailResponse> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: { user: true },
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.method !== DepositMethod.other_crypto) {
      throw new BadRequestException('This is not an other_crypto deposit');
    }

    if (deposit.status !== DepositStatus.pending) {
      throw new BadRequestException('Deposit is not pending');
    }

    const token = deposit.otherCryptoToken as OtherCryptoToken;

    // Get USD conversion rate
    let amountUsd: number;
    let rateToUsd: number;

    if (token === 'USDT') {
      amountUsd = dto.actualAmount;
      rateToUsd = 1;
    } else {
      // Get price for BNB or TON
      const ticker = token === 'BNB' ? 'BNB' : 'TON';
      const rate = await this.priceOracle.getPrice(ticker as 'BNB' | 'TON');
      amountUsd = dto.actualAmount * rate;
      rateToUsd = rate;
    }

    // Process in transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Credit user balance
      await tx.user.update({
        where: { id: deposit.userId },
        data: {
          fortuneBalance: { increment: amountUsd },
          totalFreshDeposits: { increment: amountUsd },
        },
      });

      // Update deposit
      const updatedDeposit = await tx.deposit.update({
        where: { id: depositId },
        data: {
          status: DepositStatus.credited,
          amount: dto.actualAmount,
          amountUsd,
          rateToUsd,
          creditedAt: new Date(),
          processedBy: adminUsername,
          processedAt: new Date(),
          adminNotes: dto.notes,
        },
        include: { user: true },
      });

      // Create transaction record
      await tx.transaction.create({
        data: {
          userId: deposit.userId,
          type: 'deposit',
          amount: amountUsd,
          currency: 'FORTUNE',
          netAmount: amountUsd,
          status: 'completed',
        },
      });

      // Process referral bonuses (3 levels: 5%, 3%, 1%)
      await this.processReferralBonuses(tx, deposit.user, amountUsd);

      return updatedDeposit;
    });

    // Log action
    await this.logAction(
      'approve_other_crypto_deposit',
      'deposit',
      depositId,
      { status: 'pending' },
      {
        status: 'credited',
        actualAmount: dto.actualAmount,
        amountUsd,
        notes: dto.notes,
      },
    );

    // WebSocket notification
    this.depositsGateway.emitDepositCredited({
      depositId: result.id,
      userId: result.userId,
      amount: dto.actualAmount,
      currency: token,
      amountUsd,
      newBalance: Number(result.user.fortuneBalance),
      timestamp: new Date().toISOString(),
    });

    return this.formatDepositDetail(result);
  }

  /**
   * Reject other crypto deposit
   */
  async rejectOtherCryptoDeposit(
    depositId: string,
    dto: RejectOtherCryptoDepositDto,
    adminUsername: string,
  ): Promise<DepositDetailResponse> {
    const deposit = await this.prisma.deposit.findUnique({
      where: { id: depositId },
      include: { user: true },
    });

    if (!deposit) {
      throw new NotFoundException('Deposit not found');
    }

    if (deposit.method !== DepositMethod.other_crypto) {
      throw new BadRequestException('This is not an other_crypto deposit');
    }

    if (deposit.status !== DepositStatus.pending) {
      throw new BadRequestException('Deposit is not pending');
    }

    const updated = await this.prisma.deposit.update({
      where: { id: depositId },
      data: {
        status: DepositStatus.rejected,
        rejectionReason: dto.reason,
        processedBy: adminUsername,
        processedAt: new Date(),
      },
      include: { user: true },
    });

    // Log action
    await this.logAction(
      'reject_other_crypto_deposit',
      'deposit',
      depositId,
      { status: 'pending' },
      { status: 'rejected', reason: dto.reason },
    );

    return this.formatDepositDetail(updated);
  }

  /**
   * Process referral bonuses (3 levels)
   */
  private async processReferralBonuses(
    tx: Prisma.TransactionClient,
    user: { id: string; referredById: string | null; username: string | null; firstName: string | null },
    depositAmountUsd: number,
  ): Promise<void> {
    if (!user.referredById) return;

    const REFERRAL_RATES = [0.05, 0.03, 0.01]; // 5%, 3%, 1%
    let currentReferrer = await tx.user.findUnique({
      where: { id: user.referredById },
    });

    for (let level = 0; level < 3 && currentReferrer; level++) {
      const bonus = depositAmountUsd * REFERRAL_RATES[level];

      // Credit referral balance
      await tx.user.update({
        where: { id: currentReferrer.id },
        data: { referralBalance: { increment: bonus } },
      });

      // Record referral bonus
      await tx.referralBonus.create({
        data: {
          receiverId: currentReferrer.id,
          sourceId: user.id,
          level: level + 1,
          rate: REFERRAL_RATES[level],
          amount: bonus,
          machineId: 'deposit', // Special marker for deposit-triggered bonus
          freshAmount: depositAmountUsd,
        },
      });

      this.logger.debug(
        `Referral bonus L${level + 1}: $${bonus.toFixed(2)} to ${currentReferrer.id}`,
      );

      if (currentReferrer.referredById) {
        currentReferrer = await tx.user.findUnique({
          where: { id: currentReferrer.referredById },
        });
      } else {
        break;
      }
    }
  }
}
