import { Test, TestingModule } from '@nestjs/testing';
import { ActivityService } from './activity.service';
import { PrismaService } from '../prisma/prisma.service';

describe('ActivityService', () => {
  let service: ActivityService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ActivityService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            withdrawal: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            wheelSpin: {
              findMany: jest.fn().mockResolvedValue([]),
            },
            user: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<ActivityService>(ActivityService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getFeed', () => {
    it('should return seed data if no real activity', async () => {
      const result = await service.getFeed(30);

      // Should fill with seed data (MIN_SEED_ITEMS = 15)
      expect(result.length).toBeGreaterThanOrEqual(15);
      expect(result.length).toBeLessThanOrEqual(30);
    });

    it('should include machine purchases', async () => {
      const mockPurchases = [
        {
          id: 'tx-1',
          type: 'machine_purchase',
          amount: -10,
          user: { username: 'testuser', firstName: 'Test' },
          machine: { tier: 1 },
          createdAt: new Date(),
        },
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(
        mockPurchases,
      );

      const result = await service.getFeed(30);

      const purchase = result.find((item) => item.username.includes('te'));
      expect(purchase).toBeDefined();
      expect(purchase!.type).toBe('machine_purchase');
      expect(purchase!.amount).toBe(10);
      expect(purchase!.tier).toBe(1);
    });

    it('should include completed withdrawals', async () => {
      const mockWithdrawals = [
        {
          id: 'w-1',
          usdtAmount: 50,
          user: { username: 'bigplayer', firstName: 'Big' },
          createdAt: new Date(),
        },
      ];
      (prisma.withdrawal.findMany as jest.Mock).mockResolvedValue(
        mockWithdrawals,
      );

      const result = await service.getFeed(30);

      const withdrawal = result.find(
        (item) => item.type === 'withdrawal' && item.amount === 50,
      );
      expect(withdrawal).toBeDefined();
    });

    it('should include wheel wins with multiplier', async () => {
      const mockWins = [
        {
          id: 'spin-1',
          userId: 'user-1',
          netResult: 5,
          totalPayout: 5,
          jackpotWon: false,
          spinResults: [{ multiplier: 2 }, { multiplier: 1.5 }],
          createdAt: new Date(),
        },
      ];
      (prisma.wheelSpin.findMany as jest.Mock).mockResolvedValue(mockWins);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-1', username: 'winner', firstName: 'Win' },
      ]);

      const result = await service.getFeed(30);

      const win = result.find((item) => item.type === 'wheel_win');
      expect(win).toBeDefined();
      expect(win!.amount).toBe(5);
      expect(win!.multiplier).toBe('2x');
    });

    it('should mark jackpot wins correctly', async () => {
      const mockWins = [
        {
          id: 'spin-2',
          userId: 'user-1',
          netResult: 100,
          totalPayout: 100,
          jackpotWon: true,
          spinResults: [{ multiplier: 10 }],
          createdAt: new Date(),
        },
      ];
      (prisma.wheelSpin.findMany as jest.Mock).mockResolvedValue(mockWins);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-1', username: 'luckyguy', firstName: 'Lucky' },
      ]);

      const result = await service.getFeed(30);

      const jackpot = result.find((item) => item.type === 'jackpot');
      expect(jackpot).toBeDefined();
      expect(jackpot!.amount).toBe(100);
    });

    it('should sort items by time descending', async () => {
      const now = Date.now();
      const purchases = [
        {
          id: 'tx-1',
          type: 'machine_purchase',
          amount: -10,
          user: { username: 'first', firstName: 'A' },
          machine: { tier: 1 },
          createdAt: new Date(now - 60000), // 1 min ago
        },
      ];
      const withdrawals = [
        {
          id: 'w-1',
          usdtAmount: 50,
          user: { username: 'second', firstName: 'B' },
          createdAt: new Date(now), // now
        },
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(purchases);
      (prisma.withdrawal.findMany as jest.Mock).mockResolvedValue(withdrawals);

      const result = await service.getFeed(30);

      // Most recent should come first (withdrawal was more recent)
      const realItems = result.filter(
        (i) => i.username.includes('fi') || i.username.includes('se'),
      );
      if (realItems.length >= 2) {
        const first = new Date(realItems[0].createdAt).getTime();
        const second = new Date(realItems[1].createdAt).getTime();
        expect(first).toBeGreaterThanOrEqual(second);
      }
    });

    it('should respect limit parameter', async () => {
      const result = await service.getFeed(5);

      expect(result.length).toBeLessThanOrEqual(5);
    });

    it('should mask usernames properly', async () => {
      const purchases = [
        {
          id: 'tx-1',
          type: 'machine_purchase',
          amount: -10,
          user: { username: 'longusername', firstName: 'Long' },
          machine: { tier: 1 },
          createdAt: new Date(),
        },
      ];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(purchases);

      const result = await service.getFeed(30);

      const item = result.find((i) => i.username === 'lo***me');
      expect(item).toBeDefined();
    });
  });
});
