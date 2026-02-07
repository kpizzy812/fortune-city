import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { FameService } from './fame.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

describe('FameService', () => {
  let service: FameService;
  let prisma: jest.Mocked<PrismaService>;
  let settingsService: jest.Mocked<SettingsService>;

  const mockUserId = 'user-123';

  const defaultSettings = {
    fameDailyLogin: 10,
    fameStreakBonus: 2,
    fameStreakCap: 20,
    famePerHourByTier: { '1': 1, '2': 2, '3': 3 },
    famePerManualCollect: 5,
    famePurchaseByTier: { '1': 10, '2': 20, '3': 30 },
    fameUpgradeMultiplier: 2,
    fameUnlockCostByTier: { '2': 100, '3': 300, '4': 600 },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FameService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              update: jest.fn(),
              updateMany: jest.fn(),
              findUniqueOrThrow: jest.fn(),
            },
            fameTransaction: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            machine: {
              update: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(defaultSettings),
          },
        },
      ],
    }).compile();

    service = module.get<FameService>(FameService);
    prisma = module.get(PrismaService);
    settingsService = module.get(SettingsService);

    jest.clearAllMocks();
  });

  // ==================== earnFame ====================

  describe('earnFame', () => {
    it('should increment fame and create transaction', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({ fame: 15 });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.earnFame(mockUserId, 10, 'daily_login', {
        description: 'test',
      });

      expect(result).toBe(15);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          fame: { increment: 10 },
          totalFameEarned: { increment: 10 },
        },
        select: { fame: true },
      });
      expect(prisma.fameTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          amount: 10,
          balanceAfter: 15,
          source: 'daily_login',
          description: 'test',
          machineId: undefined,
        },
      });
    });

    it('should return 0 for zero or negative amount', async () => {
      const result = await service.earnFame(mockUserId, 0, 'daily_login');

      expect(result).toBe(0);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should use provided tx client', async () => {
      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({ fame: 10 }) },
        fameTransaction: { create: jest.fn() },
      };

      await service.earnFame(mockUserId, 5, 'machine_passive', {
        tx: mockTx as any,
      });

      expect(mockTx.user.update).toHaveBeenCalled();
      expect(mockTx.fameTransaction.create).toHaveBeenCalled();
      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  // ==================== spendFame ====================

  describe('spendFame', () => {
    it('should decrement fame and create transaction', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 90,
      });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.spendFame(mockUserId, 10, 'tier_unlock');

      expect(result).toBe(90);
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: mockUserId, fame: { gte: 10 } },
        data: { fame: { decrement: 10 } },
      });
      expect(prisma.fameTransaction.create).toHaveBeenCalledWith({
        data: {
          userId: mockUserId,
          amount: -10,
          balanceAfter: 90,
          source: 'tier_unlock',
          description: undefined,
        },
      });
    });

    it('should throw if amount is zero or negative', async () => {
      await expect(
        service.spendFame(mockUserId, 0, 'tier_unlock'),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.spendFame(mockUserId, -5, 'tier_unlock'),
      ).rejects.toThrow('Amount must be positive');
    });

    it('should throw if not enough fame', async () => {
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 0 });

      await expect(
        service.spendFame(mockUserId, 1000, 'tier_unlock'),
      ).rejects.toThrow('Not enough Fame');
    });
  });

  // ==================== getBalance ====================

  describe('getBalance', () => {
    it('should return fame balance', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 100,
        totalFameEarned: 200,
        loginStreak: 5,
        lastLoginDate: new Date('2026-02-07'),
        maxTierUnlocked: 3,
      });

      const result = await service.getBalance(mockUserId);

      expect(result).toEqual({
        fame: 100,
        totalFameEarned: 200,
        loginStreak: 5,
        lastLoginDate: '2026-02-07T00:00:00.000Z',
        maxTierUnlocked: 3,
      });
    });

    it('should return null lastLoginDate if never logged in', async () => {
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 0,
        totalFameEarned: 0,
        loginStreak: 0,
        lastLoginDate: null,
        maxTierUnlocked: 1,
      });

      const result = await service.getBalance(mockUserId);

      expect(result.lastLoginDate).toBeNull();
    });
  });

  // ==================== getHistory ====================

  describe('getHistory', () => {
    it('should return paginated history', async () => {
      const items = [
        {
          id: 'tx-1',
          amount: 10,
          balanceAfter: 10,
          source: 'daily_login',
          description: 'Day 1',
          machineId: null,
          createdAt: new Date('2026-02-07T12:00:00Z'),
        },
      ];

      (prisma.fameTransaction.findMany as jest.Mock).mockResolvedValue(items);
      (prisma.fameTransaction.count as jest.Mock).mockResolvedValue(1);

      const result = await service.getHistory(mockUserId, 1, 20);

      expect(result.items).toHaveLength(1);
      expect(result.items[0].id).toBe('tx-1');
      expect(result.items[0].createdAt).toBe('2026-02-07T12:00:00.000Z');
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('should clamp limit between 1 and 100', async () => {
      (prisma.fameTransaction.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.fameTransaction.count as jest.Mock).mockResolvedValue(0);

      await service.getHistory(mockUserId, 1, 200);

      expect(prisma.fameTransaction.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 100 }),
      );
    });
  });

  // ==================== claimDailyLogin ====================

  describe('claimDailyLogin', () => {
    it('should claim daily login on first day', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 0,
        loginStreak: 0,
        lastLoginDate: null,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ fame: 10 });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});
      (settingsService.getSettings as jest.Mock).mockResolvedValue(
        defaultSettings,
      );

      const result = await service.claimDailyLogin(mockUserId);

      expect(result.streak).toBe(1);
      expect(result.earned).toBe(10); // base daily, no streak bonus
    });

    it('should throw ConflictException if already claimed today', async () => {
      const today = new Date();
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 10,
        loginStreak: 1,
        lastLoginDate: today,
      });

      await expect(service.claimDailyLogin(mockUserId)).rejects.toThrow(
        ConflictException,
      );
    });

    it('should increment streak if logged in yesterday', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 50,
        loginStreak: 3,
        lastLoginDate: yesterday,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ fame: 66 });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.claimDailyLogin(mockUserId);

      expect(result.streak).toBe(4);
      // base(10) + streakBonus(min(3*2, 20)) = 10 + 6 = 16
      expect(result.earned).toBe(16);
    });

    it('should reset streak if more than 1 day gap', async () => {
      const twoDaysAgo = new Date();
      twoDaysAgo.setUTCDate(twoDaysAgo.getUTCDate() - 2);

      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 50,
        loginStreak: 10,
        lastLoginDate: twoDaysAgo,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ fame: 60 });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.claimDailyLogin(mockUserId);

      expect(result.streak).toBe(1); // reset
      expect(result.earned).toBe(10); // base only
    });

    it('should cap streak bonus', async () => {
      const yesterday = new Date();
      yesterday.setUTCDate(yesterday.getUTCDate() - 1);

      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 100,
        loginStreak: 30, // huge streak
        lastLoginDate: yesterday,
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({ fame: 130 });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.claimDailyLogin(mockUserId);

      expect(result.streak).toBe(31);
      // streakBonus = min(30*2, 20) = 20 (capped)
      expect(result.earned).toBe(30); // 10 + 20
    });
  });

  // ==================== unlockTier ====================

  describe('unlockTier', () => {
    it('should unlock next sequential tier', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock)
        .mockResolvedValueOnce({ fame: 200, maxTierUnlocked: 1 }) // initial check
        .mockResolvedValueOnce({ fame: 100 }); // after spend
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
      (prisma.user.update as jest.Mock).mockResolvedValue({
        fame: 100,
        maxTierUnlocked: 2,
      });
      (prisma.fameTransaction.create as jest.Mock).mockResolvedValue({});

      const result = await service.unlockTier(mockUserId, 2);

      expect(result.tier).toBe(2);
      expect(result.cost).toBe(100);
      expect(result.maxTierUnlocked).toBe(2);
      expect(result.remainingFame).toBe(100);
    });

    it('should throw for invalid tier range', async () => {
      await expect(service.unlockTier(mockUserId, 1)).rejects.toThrow(
        'Tier must be between 2 and 10',
      );

      await expect(service.unlockTier(mockUserId, 11)).rejects.toThrow(
        'Tier must be between 2 and 10',
      );
    });

    it('should throw if trying to skip tiers', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 1000,
        maxTierUnlocked: 1,
      });

      await expect(service.unlockTier(mockUserId, 3)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if not enough fame', async () => {
      (prisma.$transaction as jest.Mock).mockImplementation((cb) => cb(prisma));
      (prisma.user.findUniqueOrThrow as jest.Mock).mockResolvedValue({
        fame: 50, // not enough for 100
        maxTierUnlocked: 1,
      });

      await expect(service.unlockTier(mockUserId, 2)).rejects.toThrow(
        'Not enough Fame',
      );
    });
  });

  // ==================== Machine passive/manual/purchase Fame ====================

  describe('earnMachinePassiveFame', () => {
    it('should earn passive fame based on hours elapsed', async () => {
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
      const mockTx = {
        machine: { update: jest.fn() },
        user: { update: jest.fn().mockResolvedValue({ fame: 12 }) },
        fameTransaction: { create: jest.fn() },
      };

      const result = await service.earnMachinePassiveFame(
        mockUserId,
        'machine-1',
        1, // tier 1 → 1 fame/hour
        twoHoursAgo,
        mockTx as any,
      );

      // 2 hours * 1 fame/hour = 2 (floored)
      expect(result).toBe(2);
      expect(mockTx.machine.update).toHaveBeenCalledWith({
        where: { id: 'machine-1' },
        data: {
          lastFameCalculatedAt: expect.any(Date),
          fameGenerated: { increment: 2 },
        },
      });
    });

    it('should return 0 if elapsed time is too small', async () => {
      const justNow = new Date(Date.now() - 10 * 1000); // 10 sec ago
      const mockTx = {} as any;

      const result = await service.earnMachinePassiveFame(
        mockUserId,
        'machine-1',
        1,
        justNow,
        mockTx,
      );

      expect(result).toBe(0);
    });
  });

  describe('earnManualCollectFame', () => {
    it('should earn fame for manual collect', async () => {
      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({ fame: 15 }) },
        fameTransaction: { create: jest.fn() },
      };

      const result = await service.earnManualCollectFame(
        mockUserId,
        'machine-1',
        mockTx as any,
      );

      expect(result).toBe(5); // famePerManualCollect from settings
    });

    it('should return 0 if setting is 0', async () => {
      (settingsService.getSettings as jest.Mock).mockResolvedValue({
        ...defaultSettings,
        famePerManualCollect: 0,
      });
      const mockTx = {} as any;

      const result = await service.earnManualCollectFame(
        mockUserId,
        'machine-1',
        mockTx,
      );

      expect(result).toBe(0);
    });
  });

  describe('earnPurchaseFame', () => {
    it('should earn fame for regular purchase', async () => {
      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({ fame: 20 }) },
        fameTransaction: { create: jest.fn() },
      };

      const result = await service.earnPurchaseFame(
        mockUserId,
        1, // tier 1 → 10 fame
        false,
        mockTx as any,
      );

      expect(result).toBe(10);
    });

    it('should earn double for upgrade purchase', async () => {
      const mockTx = {
        user: { update: jest.fn().mockResolvedValue({ fame: 40 }) },
        fameTransaction: { create: jest.fn() },
      };

      const result = await service.earnPurchaseFame(
        mockUserId,
        1,
        true, // isUpgrade
        mockTx as any,
      );

      expect(result).toBe(20); // 10 * 2 (multiplier)
    });

    it('should return 0 for unknown tier', async () => {
      const mockTx = {} as any;

      const result = await service.earnPurchaseFame(
        mockUserId,
        99, // unknown tier
        false,
        mockTx,
      );

      expect(result).toBe(0);
    });
  });
});
