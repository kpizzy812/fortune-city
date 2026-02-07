import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { WheelService } from './wheel.service';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { WheelGateway } from './wheel.gateway';
import { WheelNotificationService } from './wheel-notification.service';
import { ReferralsService } from '../referrals/referrals.service';

describe('WheelService', () => {
  let service: WheelService;
  let prisma: jest.Mocked<PrismaService>;
  let settingsService: jest.Mocked<SettingsService>;
  let wheelGateway: jest.Mocked<WheelGateway>;
  let notificationService: jest.Mocked<WheelNotificationService>;
  let referralsService: jest.Mocked<ReferralsService>;

  const mockUserId = 'user-123';

  const mockSettings = {
    wheelBetAmount: new Prisma.Decimal(1),
    wheelSectors: [
      { sector: 'lose', chance: 0.4, multiplier: 0 },
      { sector: 'x1.5', chance: 0.25, multiplier: 1.5 },
      { sector: 'x2', chance: 0.2, multiplier: 2 },
      { sector: 'x5', chance: 0.1, multiplier: 5 },
      { sector: 'jackpot', chance: 0.05, multiplier: 0 },
    ],
    wheelBurnRate: new Prisma.Decimal(0.5),
    wheelPoolRate: new Prisma.Decimal(0.5),
    wheelJackpotCap: new Prisma.Decimal(1000),
    wheelMultipliers: [1, 5, 50],
    wheelFreeSpinsBase: 3,
    wheelFreeSpinsPerRef: 1,
  };

  const mockUser = {
    id: mockUserId,
    username: 'testplayer',
    firstName: 'Test',
    fortuneBalance: new Prisma.Decimal(100),
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    telegramId: '12345',
  };

  const mockJackpot = {
    id: 'current',
    currentPool: new Prisma.Decimal(500),
    poolCap: new Prisma.Decimal(1000),
    totalPaidOut: new Prisma.Decimal(0),
    totalBurned: new Prisma.Decimal(0),
    totalContributed: new Prisma.Decimal(0),
    timesWon: 0,
    lastWinnerId: null,
    lastWonAmount: null,
    lastWonAt: null,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WheelService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            wheelJackpot: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            wheelSpin: {
              create: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
            },
            transaction: { create: jest.fn() },
            $transaction: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(mockSettings),
          },
        },
        {
          provide: WheelGateway,
          useValue: {
            emitJackpotWon: jest.fn(),
            emitJackpotUpdated: jest.fn(),
          },
        },
        {
          provide: WheelNotificationService,
          useValue: {
            notifyWinnerPersonally: jest.fn(),
            broadcastJackpotWin: jest.fn(),
          },
        },
        {
          provide: ReferralsService,
          useValue: {
            getActiveReferralCount: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WheelService>(WheelService);
    prisma = module.get(PrismaService);
    settingsService = module.get(SettingsService);
    wheelGateway = module.get(WheelGateway);
    notificationService = module.get(WheelNotificationService);
    referralsService = module.get(ReferralsService);

    jest.clearAllMocks();
  });

  describe('spin', () => {
    it('should throw if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.spin(mockUserId, 1)).rejects.toThrow(
        'User not found',
      );
    });

    it('should throw if insufficient balance', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(0.5),
      });

      await expect(service.spin(mockUserId, 1)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('should execute spin and return result', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(
        mockJackpot,
      );

      const updatedUser = {
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(99),
        freeSpinsRemaining: 0,
      };
      const spin = { id: 'spin-1' };
      const updatedJackpot = { ...mockJackpot };

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        updatedUser,
        spin,
        updatedJackpot,
      ]);

      const result = await service.spin(mockUserId, 1);

      expect(result.success).toBe(true);
      expect(result.spinId).toBe('spin-1');
      expect(result.betMultiplier).toBe(1);
      expect(result.totalBet).toBe(1);
      expect(typeof result.totalPayout).toBe('number');
      expect(typeof result.netResult).toBe('number');
      expect(result.result).toBeDefined();
      expect(result.result.sector).toBeDefined();
    });

    it('should use free spins when available', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        freeSpinsRemaining: 3,
        fortuneBalance: new Prisma.Decimal(0), // No balance needed
      });
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(
        mockJackpot,
      );

      const updatedUser = {
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(0),
        freeSpinsRemaining: 2,
      };
      const spin = { id: 'spin-2' };

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        updatedUser,
        spin,
        mockJackpot,
      ]);

      const result = await service.spin(mockUserId, 1);

      expect(result.success).toBe(true);
      expect(result.freeSpinsUsed).toBe(1);
    });

    it('should use mix of free and paid spins for multiplier', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        ...mockUser,
        freeSpinsRemaining: 2,
        fortuneBalance: new Prisma.Decimal(10), // 3 paid units needed at $1 each
      });
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(
        mockJackpot,
      );

      const updatedUser = {
        ...mockUser,
        freeSpinsRemaining: 0,
      };

      (prisma.$transaction as jest.Mock).mockResolvedValue([
        updatedUser,
        { id: 'spin-3' },
        mockJackpot,
      ]);

      const result = await service.spin(mockUserId, 5);

      expect(result.success).toBe(true);
      expect(result.freeSpinsUsed).toBe(2);
      expect(result.totalBet).toBe(5); // 5 × $1
    });
  });

  describe('getState', () => {
    it('should return wheel state', async () => {
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(
        mockJackpot,
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const state = await service.getState(mockUserId);

      expect(state.jackpotPool).toBe(500);
      expect(state.betAmount).toBe(1);
      expect(state.sectors).toHaveLength(5);
      expect(state.freeSpinsRemaining).toBe(0);
      expect(state.multipliers).toEqual([1, 5, 50]);
    });

    it('should handle missing jackpot', async () => {
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const state = await service.getState(mockUserId);

      expect(state.jackpotPool).toBe(0);
    });
  });

  describe('getHistory', () => {
    it('should return paginated spin history', async () => {
      const mockSpins = [
        {
          id: 'spin-1',
          totalBet: new Prisma.Decimal(5),
          betAmount: new Prisma.Decimal(1),
          totalPayout: new Prisma.Decimal(10),
          netResult: new Prisma.Decimal(5),
          jackpotWon: false,
          jackpotAmount: new Prisma.Decimal(0),
          createdAt: new Date(),
        },
      ];

      (prisma.wheelSpin.findMany as jest.Mock).mockResolvedValue(mockSpins);
      (prisma.wheelSpin.count as jest.Mock).mockResolvedValue(1);

      const history = await service.getHistory(mockUserId, 1, 20);

      expect(history.items).toHaveLength(1);
      expect(history.items[0].betMultiplier).toBe(5);
      expect(history.items[0].totalBet).toBe(5);
      expect(history.total).toBe(1);
      expect(history.page).toBe(1);
    });

    it('should handle empty history', async () => {
      (prisma.wheelSpin.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.wheelSpin.count as jest.Mock).mockResolvedValue(0);

      const history = await service.getHistory(mockUserId);

      expect(history.items).toHaveLength(0);
      expect(history.total).toBe(0);
    });
  });

  describe('getJackpotInfo', () => {
    it('should return jackpot info', async () => {
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(
        mockJackpot,
      );

      const info = await service.getJackpotInfo();

      expect(info.currentPool).toBe(500);
      expect(info.timesWon).toBe(0);
      expect(info.lastWinner).toBeNull();
    });

    it('should return defaults if no jackpot record', async () => {
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(null);

      const info = await service.getJackpotInfo();

      expect(info.currentPool).toBe(0);
      expect(info.timesWon).toBe(0);
    });
  });

  describe('getRecentWins', () => {
    it('should return recent wins with usernames', async () => {
      const mockSpins = [
        {
          id: 'spin-1',
          userId: 'user-1',
          totalPayout: new Prisma.Decimal(5),
          netResult: new Prisma.Decimal(4),
          jackpotWon: false,
          jackpotAmount: new Prisma.Decimal(0),
          spinCount: 1,
          spinResults: [{ multiplier: 5 }],
          createdAt: new Date(),
        },
      ];

      (prisma.wheelSpin.findMany as jest.Mock).mockResolvedValue(mockSpins);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'user-1', username: 'testplayer', firstName: 'Test' },
      ]);

      const wins = await service.getRecentWins(20);

      // Should have at least 15 items (seed fills remaining)
      expect(wins.length).toBeGreaterThanOrEqual(1);
      // Real win should be included
      const realWin = wins.find((w) => w.id === 'spin-1');
      expect(realWin).toBeDefined();
      expect(realWin!.payout).toBe(5);
    });

    it('should fill with seed data when not enough real wins', async () => {
      (prisma.wheelSpin.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

      const wins = await service.getRecentWins(20);

      expect(wins.length).toBe(15); // MIN_ITEMS
    });
  });

  describe('resetDailyFreeSpins', () => {
    it('should reset spins for non-referrers and calculate for referrers', async () => {
      (prisma.user.findMany as jest.Mock).mockResolvedValue([
        { id: 'referrer-1' },
      ]);
      (prisma.user.updateMany as jest.Mock).mockResolvedValue({ count: 10 });
      (referralsService.getActiveReferralCount as jest.Mock).mockResolvedValue(
        5,
      );
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.resetDailyFreeSpins();

      // 10 non-referrers + 1 referrer
      expect(result).toBe(11);

      // Non-referrers get base spins
      expect(prisma.user.updateMany).toHaveBeenCalledWith({
        where: { id: { notIn: ['referrer-1'] } },
        data: { freeSpinsRemaining: 3 },
      });

      // Referrer gets base + activeRefs × perRef = 3 + 5 × 1 = 8
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'referrer-1' },
        data: { freeSpinsRemaining: 8 },
      });
    });
  });

  describe('onModuleInit', () => {
    it('should create jackpot if not exists', async () => {
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.wheelJackpot.create as jest.Mock).mockResolvedValue({});

      await service.onModuleInit();

      expect(prisma.wheelJackpot.create).toHaveBeenCalledWith({
        data: {
          id: 'current',
          currentPool: 0,
          poolCap: 1000,
        },
      });
    });

    it('should not create jackpot if already exists', async () => {
      (prisma.wheelJackpot.findUnique as jest.Mock).mockResolvedValue(
        mockJackpot,
      );

      await service.onModuleInit();

      expect(prisma.wheelJackpot.create).not.toHaveBeenCalled();
    });
  });
});
