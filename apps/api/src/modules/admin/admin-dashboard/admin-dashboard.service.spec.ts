import { Test, TestingModule } from '@nestjs/testing';
import { AdminDashboardService } from './admin-dashboard.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminDashboardService', () => {
  let service: AdminDashboardService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDashboardService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              count: jest.fn(),
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
            machine: {
              count: jest.fn(),
              groupBy: jest.fn(),
              findMany: jest.fn(),
            },
            deposit: {
              aggregate: jest.fn(),
              findMany: jest.fn(),
            },
            withdrawal: {
              aggregate: jest.fn(),
              count: jest.fn(),
              findMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminDashboardService>(AdminDashboardService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getStats', () => {
    it('should return dashboard statistics', async () => {
      // Mock all parallel queries
      (prisma.user.count as jest.Mock)
        .mockResolvedValueOnce(1000) // totalUsers
        .mockResolvedValueOnce(200) // activeUsers
        .mockResolvedValueOnce(15) // newUsersToday
        .mockResolvedValueOnce(80); // newUsersWeek

      (prisma.machine.count as jest.Mock)
        .mockResolvedValueOnce(500) // totalMachines
        .mockResolvedValueOnce(300); // activeMachines

      (prisma.deposit.aggregate as jest.Mock)
        .mockResolvedValueOnce({
          _count: 200,
          _sum: { amountUsd: 50000 },
        }) // deposits all-time
        .mockResolvedValueOnce({
          _count: 5,
          _sum: { amountUsd: 1200 },
        }); // deposits today

      (prisma.withdrawal.aggregate as jest.Mock)
        .mockResolvedValueOnce({
          _count: 100,
          _sum: { usdtAmount: 20000 },
        }) // withdrawals all-time
        .mockResolvedValueOnce({
          _count: 3,
          _sum: { usdtAmount: 500 },
        }); // withdrawals today

      (prisma.withdrawal.count as jest.Mock).mockResolvedValue(10); // pending

      (prisma.user.aggregate as jest.Mock).mockResolvedValue({
        _sum: { fortuneBalance: 75000 },
      });

      // Tax aggregate (last call)
      (prisma.withdrawal.aggregate as jest.Mock).mockResolvedValueOnce({
        _sum: { taxAmount: 5000 },
      });

      const stats = await service.getStats();

      expect(stats.totalUsers).toBe(1000);
      expect(stats.activeUsers).toBe(200);
      expect(stats.newUsersToday).toBe(15);
      expect(stats.totalMachines).toBe(500);
      expect(stats.activeMachines).toBe(300);
      expect(stats.totalDeposits).toBe(200);
      expect(stats.pendingWithdrawals).toBe(10);
    });
  });

  describe('getChartData', () => {
    it('should return chart data for given period', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.deposit.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.withdrawal.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.machine.findMany as jest.Mock).mockResolvedValue([]);

      const chartData = await service.getChartData(7);

      expect(chartData.usersChart).toBeDefined();
      expect(chartData.depositsChart).toBeDefined();
      expect(chartData.withdrawalsChart).toBeDefined();
      expect(chartData.revenueChart).toBeDefined();
      expect(chartData.machinesChart).toBeDefined();

      // Should have approximately 8 data points (7 days + today)
      expect(chartData.usersChart.length).toBeGreaterThanOrEqual(7);
    });
  });

  describe('getTierDistribution', () => {
    it('should return tier distribution', async () => {
      (prisma.machine.groupBy as jest.Mock).mockResolvedValue([
        { tier: 1, _count: 100, _sum: { purchasePrice: 1000 } },
        { tier: 3, _count: 50, _sum: { purchasePrice: 10000 } },
        { tier: 5, _count: 20, _sum: { purchasePrice: 12000 } },
      ]);

      const dist = await service.getTierDistribution();

      expect(dist).toHaveLength(3);
      expect(dist[0]).toEqual({ tier: 1, count: 100, totalValue: 1000 });
      expect(dist[1]).toEqual({ tier: 3, count: 50, totalValue: 10000 });
    });

    it('should handle empty distribution', async () => {
      (prisma.machine.groupBy as jest.Mock).mockResolvedValue([]);

      const dist = await service.getTierDistribution();

      expect(dist).toHaveLength(0);
    });
  });
});
