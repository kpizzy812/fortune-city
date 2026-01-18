import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

export interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  newUsersToday: number;
  newUsersWeek: number;
  totalMachines: number;
  activeMachines: number;
  totalDeposits: number;
  totalDepositsAmount: number;
  depositsToday: number;
  depositsAmountToday: number;
  totalWithdrawals: number;
  totalWithdrawalsAmount: number;
  pendingWithdrawals: number;
  withdrawalsToday: number;
  withdrawalsAmountToday: number;
  totalFortuneBalance: number;
  totalTaxCollected: number;
}

export interface ChartDataPoint {
  date: string;
  value: number;
  label?: string;
}

export interface DashboardChartData {
  usersChart: ChartDataPoint[];
  depositsChart: ChartDataPoint[];
  withdrawalsChart: ChartDataPoint[];
  revenueChart: ChartDataPoint[];
  machinesChart: ChartDataPoint[];
}

export interface TierDistribution {
  tier: number;
  count: number;
  totalValue: number;
}

@Injectable()
export class AdminDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getStats(): Promise<DashboardStats> {
    const now = new Date();
    const todayStart = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate(),
    );
    const weekAgo = new Date(todayStart);
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Run queries in parallel for performance
    const [
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersWeek,
      totalMachines,
      activeMachines,
      depositsAgg,
      depositsTodayAgg,
      withdrawalsAgg,
      withdrawalsTodayAgg,
      pendingWithdrawals,
      balanceAgg,
      taxAgg,
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

      // New users today
      this.prisma.user.count({
        where: { createdAt: { gte: todayStart } },
      }),

      // New users this week
      this.prisma.user.count({
        where: { createdAt: { gte: weekAgo } },
      }),

      // Total machines
      this.prisma.machine.count(),

      // Active machines
      this.prisma.machine.count({
        where: { status: 'active' },
      }),

      // Deposits aggregate (all time)
      this.prisma.deposit.aggregate({
        _count: true,
        _sum: { amountUsd: true },
        where: { status: 'credited' },
      }),

      // Deposits today
      this.prisma.deposit.aggregate({
        _count: true,
        _sum: { amountUsd: true },
        where: {
          status: 'credited',
          createdAt: { gte: todayStart },
        },
      }),

      // Withdrawals aggregate (all time)
      this.prisma.withdrawal.aggregate({
        _count: true,
        _sum: { usdtAmount: true },
        where: { status: 'completed' },
      }),

      // Withdrawals today
      this.prisma.withdrawal.aggregate({
        _count: true,
        _sum: { usdtAmount: true },
        where: {
          status: 'completed',
          createdAt: { gte: todayStart },
        },
      }),

      // Pending withdrawals
      this.prisma.withdrawal.count({
        where: { status: 'pending' },
      }),

      // Total fortune balance
      this.prisma.user.aggregate({
        _sum: { fortuneBalance: true },
      }),

      // Total tax collected
      this.prisma.withdrawal.aggregate({
        _sum: { taxAmount: true },
        where: { status: 'completed' },
      }),
    ]);

    return {
      totalUsers,
      activeUsers,
      newUsersToday,
      newUsersWeek,
      totalMachines,
      activeMachines,
      totalDeposits: depositsAgg._count,
      totalDepositsAmount: Number(depositsAgg._sum.amountUsd || 0),
      depositsToday: depositsTodayAgg._count,
      depositsAmountToday: Number(depositsTodayAgg._sum.amountUsd || 0),
      totalWithdrawals: withdrawalsAgg._count,
      totalWithdrawalsAmount: Number(withdrawalsAgg._sum.usdtAmount || 0),
      pendingWithdrawals,
      withdrawalsToday: withdrawalsTodayAgg._count,
      withdrawalsAmountToday: Number(withdrawalsTodayAgg._sum.usdtAmount || 0),
      totalFortuneBalance: Number(balanceAgg._sum.fortuneBalance || 0),
      totalTaxCollected: Number(taxAgg._sum.taxAmount || 0),
    };
  }

  async getChartData(days: number = 30): Promise<DashboardChartData> {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    // Generate date range
    const dates: Date[] = [];
    for (
      let d = new Date(startDate);
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      dates.push(new Date(d));
    }

    // Get all data in parallel
    const [users, deposits, withdrawals, machines] = await Promise.all([
      // Users created per day
      this.prisma.user.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true },
      }),

      // Deposits per day
      this.prisma.deposit.findMany({
        where: {
          status: 'credited',
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, amountUsd: true },
      }),

      // Withdrawals per day
      this.prisma.withdrawal.findMany({
        where: {
          status: 'completed',
          createdAt: { gte: startDate },
        },
        select: { createdAt: true, usdtAmount: true, taxAmount: true },
      }),

      // Machines created per day
      this.prisma.machine.findMany({
        where: { createdAt: { gte: startDate } },
        select: { createdAt: true, purchasePrice: true },
      }),
    ]);

    // Group by date helper
    const groupByDate = <T extends { createdAt: Date }>(
      items: T[],
      getValue: (item: T) => number,
    ): Map<string, number> => {
      const map = new Map<string, number>();
      items.forEach((item) => {
        const dateKey = item.createdAt.toISOString().split('T')[0];
        map.set(dateKey, (map.get(dateKey) || 0) + getValue(item));
      });
      return map;
    };

    const usersMap = groupByDate(users, () => 1);
    const depositsMap = groupByDate(deposits, (d) => Number(d.amountUsd));
    const withdrawalsMap = groupByDate(withdrawals, (w) =>
      Number(w.usdtAmount),
    );
    const revenueMap = groupByDate(withdrawals, (w) => Number(w.taxAmount));
    const machinesMap = groupByDate(machines, () => 1);

    // Create chart data
    const formatDate = (d: Date) => d.toISOString().split('T')[0];

    return {
      usersChart: dates.map((d) => ({
        date: formatDate(d),
        value: usersMap.get(formatDate(d)) || 0,
      })),
      depositsChart: dates.map((d) => ({
        date: formatDate(d),
        value: Math.round((depositsMap.get(formatDate(d)) || 0) * 100) / 100,
      })),
      withdrawalsChart: dates.map((d) => ({
        date: formatDate(d),
        value: Math.round((withdrawalsMap.get(formatDate(d)) || 0) * 100) / 100,
      })),
      revenueChart: dates.map((d) => ({
        date: formatDate(d),
        value: Math.round((revenueMap.get(formatDate(d)) || 0) * 100) / 100,
      })),
      machinesChart: dates.map((d) => ({
        date: formatDate(d),
        value: machinesMap.get(formatDate(d)) || 0,
      })),
    };
  }

  async getTierDistribution(): Promise<TierDistribution[]> {
    const machines = await this.prisma.machine.groupBy({
      by: ['tier'],
      where: { status: 'active' },
      _count: true,
      _sum: { purchasePrice: true },
      orderBy: { tier: 'asc' },
    });

    return machines.map((m) => ({
      tier: m.tier,
      count: m._count,
      totalValue: Number(m._sum.purchasePrice || 0),
    }));
  }
}
