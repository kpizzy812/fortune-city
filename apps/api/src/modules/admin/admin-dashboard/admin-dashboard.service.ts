import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMachines: number;
  activeMachines: number;
  totalDeposits: number;
  totalDepositsAmount: number;
  totalWithdrawals: number;
  totalWithdrawalsAmount: number;
  pendingWithdrawals: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    // Run queries in parallel for performance
    const [
      totalUsers,
      activeUsers,
      totalMachines,
      activeMachines,
      depositsAgg,
      withdrawalsAgg,
      pendingWithdrawals,
    ] = await Promise.all([
      // Total users
      this.prisma.user.count(),

      // Active users (have at least one active machine)
      this.prisma.user.count({
        where: {
          machines: {
            some: {
              status: 'active',
            },
          },
        },
      }),

      // Total machines
      this.prisma.machine.count(),

      // Active machines
      this.prisma.machine.count({
        where: { status: 'active' },
      }),

      // Deposits aggregate
      this.prisma.deposit.aggregate({
        _count: true,
        _sum: {
          amountUsd: true,
        },
        where: {
          status: 'credited',
        },
      }),

      // Withdrawals aggregate
      this.prisma.withdrawal.aggregate({
        _count: true,
        _sum: {
          usdtAmount: true,
        },
        where: {
          status: 'completed',
        },
      }),

      // Pending withdrawals
      this.prisma.withdrawal.count({
        where: { status: 'pending' },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      totalMachines,
      activeMachines,
      totalDeposits: depositsAgg._count,
      totalDepositsAmount: Number(depositsAgg._sum.amountUsd || 0),
      totalWithdrawals: withdrawalsAgg._count,
      totalWithdrawalsAmount: Number(withdrawalsAgg._sum.usdtAmount || 0),
      pendingWithdrawals,
    };
  }
}
