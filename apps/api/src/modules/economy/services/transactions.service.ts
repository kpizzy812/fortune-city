import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  Transaction,
  TransactionType,
  TransactionStatus,
  Currency,
  Prisma,
} from '@prisma/client';

export interface CreateTransactionInput {
  userId: string;
  machineId?: string;
  type: TransactionType;
  amount: Prisma.Decimal | number;
  currency: Currency;
  taxAmount?: Prisma.Decimal | number;
  taxRate?: Prisma.Decimal | number;
  netAmount: Prisma.Decimal | number;
  fromFreshDeposit?: Prisma.Decimal | number;
  fromProfit?: Prisma.Decimal | number;
  chain?: string;
  txHash?: string;
  status?: TransactionStatus;
}

@Injectable()
export class TransactionsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    input: CreateTransactionInput,
    tx?: Prisma.TransactionClient,
  ): Promise<Transaction> {
    const client = tx ?? this.prisma;

    return client.transaction.create({
      data: {
        userId: input.userId,
        machineId: input.machineId,
        type: input.type,
        amount: input.amount,
        currency: input.currency,
        taxAmount: input.taxAmount ?? 0,
        taxRate: input.taxRate ?? 0,
        netAmount: input.netAmount,
        fromFreshDeposit: input.fromFreshDeposit ?? 0,
        fromProfit: input.fromProfit ?? 0,
        chain: input.chain,
        txHash: input.txHash,
        status: input.status ?? 'completed',
      },
    });
  }

  async findById(id: string): Promise<Transaction | null> {
    return this.prisma.transaction.findUnique({
      where: { id },
    });
  }

  async findByUserId(
    userId: string,
    options?: {
      type?: TransactionType;
      status?: TransactionStatus;
      limit?: number;
      offset?: number;
    },
  ): Promise<Transaction[]> {
    return this.prisma.transaction.findMany({
      where: {
        userId,
        ...(options?.type && { type: options.type }),
        ...(options?.status && { status: options.status }),
      },
      orderBy: { createdAt: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    });
  }

  async updateStatus(
    id: string,
    status: TransactionStatus,
    tx?: Prisma.TransactionClient,
  ): Promise<Transaction> {
    const client = tx ?? this.prisma;

    return client.transaction.update({
      where: { id },
      data: { status },
    });
  }

  async getUserTransactionStats(userId: string): Promise<{
    totalDeposits: number;
    totalWithdrawals: number;
    totalMachinesPurchased: number;
    totalEarnings: number;
  }> {
    const [deposits, withdrawals, purchases, earnings] = await Promise.all([
      this.prisma.transaction.aggregate({
        where: { userId, type: 'deposit', status: 'completed' },
        _sum: { netAmount: true },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'withdrawal', status: 'completed' },
        _sum: { netAmount: true },
      }),
      this.prisma.transaction.count({
        where: { userId, type: 'machine_purchase', status: 'completed' },
      }),
      this.prisma.transaction.aggregate({
        where: { userId, type: 'machine_income', status: 'completed' },
        _sum: { netAmount: true },
      }),
    ]);

    return {
      totalDeposits: Number(deposits._sum.netAmount ?? 0),
      totalWithdrawals: Number(withdrawals._sum.netAmount ?? 0),
      totalMachinesPurchased: purchases,
      totalEarnings: Number(earnings._sum.netAmount ?? 0),
    };
  }
}
