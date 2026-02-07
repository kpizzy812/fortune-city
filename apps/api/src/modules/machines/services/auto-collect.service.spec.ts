import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AutoCollectService } from './auto-collect.service';
import { MachinesService } from '../machines.service';
import { PrismaService } from '../../prisma/prisma.service';
import { FameService } from '../../fame/fame.service';
import { SettingsService } from '../../settings/settings.service';
import { Prisma } from '@prisma/client';
import {
  calculateCollectorHireCost,
  calculateCollectorHireFameCost,
  COLLECTOR_SALARY_PERCENT,
} from '@fortune-city/shared';

describe('AutoCollectService', () => {
  let service: AutoCollectService;
  let prismaService: jest.Mocked<PrismaService>;
  let machinesService: jest.Mocked<MachinesService>;
  let settingsService: jest.Mocked<SettingsService>;

  const mockUserId = 'user-123';
  const mockMachineId = 'machine-123';

  // v2: Tier 1 — $10, 3d, 145%, profit $4.50
  const tier1HireCost = calculateCollectorHireCost(1); // 10% × $4.50 = $0.45
  const tier1HireFame = calculateCollectorHireFameCost(1); // 5h × 3⚡/hr = 15⚡

  const createMockMachine = (overrides = {}) => ({
    id: mockMachineId,
    userId: mockUserId,
    tier: 1,
    purchasePrice: new Prisma.Decimal(10),
    totalYield: new Prisma.Decimal(14.5),
    profitAmount: new Prisma.Decimal(4.5),
    lifespanDays: 3,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2026-01-04T00:00:00Z'),
    ratePerSecond: new Prisma.Decimal(0.0000559414),
    accumulatedIncome: new Prisma.Decimal(0),
    lastCalculatedAt: new Date('2026-01-01T00:00:00Z'),
    profitPaidOut: new Prisma.Decimal(0),
    principalPaidOut: new Prisma.Decimal(0),
    reinvestRound: 1,
    profitReductionRate: new Prisma.Decimal(0),
    coinBoxLevel: 1,
    coinBoxCapacity: new Prisma.Decimal(0.64),
    coinBoxCurrent: new Prisma.Decimal(0),
    fortuneGambleLevel: 0,
    autoCollectEnabled: false,
    autoCollectPurchasedAt: null,
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockUser = (fortuneBalance: number) => ({
    id: mockUserId,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    fortuneBalance: new Prisma.Decimal(fortuneBalance),
    maxTierReached: 1,
    maxTierUnlocked: 1,
    currentTaxRate: new Prisma.Decimal(0.5),
    referralCode: 'REF123',
    referredById: null,
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  const mockSettings = {
    id: 'default',
    collectorHirePercent: new Prisma.Decimal(10),
    collectorSalaryPercent: new Prisma.Decimal(5),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutoCollectService,
        {
          provide: MachinesService,
          useValue: {
            findByIdOrThrow: jest.fn(),
            calculateIncome: jest.fn(),
            collectCoins: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            machine: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: FameService,
          useValue: {
            spendFame: jest.fn(),
          },
        },
        {
          provide: SettingsService,
          useValue: {
            getSettings: jest.fn().mockResolvedValue(mockSettings),
          },
        },
      ],
    }).compile();

    service = module.get<AutoCollectService>(AutoCollectService);
    prismaService = module.get(PrismaService);
    machinesService = module.get(MachinesService);
    settingsService = module.get(SettingsService);

    jest.clearAllMocks();
    // Re-apply default mock after clearAllMocks
    (settingsService.getSettings as jest.Mock).mockResolvedValue(mockSettings);
  });

  describe('getAutoCollectInfo', () => {
    it('should return info for machine without Auto Collect', async () => {
      const mockMachine = createMockMachine();
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      const result = await service.getAutoCollectInfo(
        mockMachineId,
        mockUserId,
      );

      expect(result).toEqual({
        enabled: false,
        hireCost: tier1HireCost,
        hireCostFame: tier1HireFame,
        salaryPercent: COLLECTOR_SALARY_PERCENT,
        purchasedAt: null,
        canPurchase: true,
        alreadyPurchased: false,
      });
    });

    it('should return info for machine with Auto Collect enabled', async () => {
      const purchasedAt = new Date('2026-01-02T00:00:00Z');
      const mockMachine = createMockMachine({
        autoCollectEnabled: true,
        autoCollectPurchasedAt: purchasedAt,
      });
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      const result = await service.getAutoCollectInfo(
        mockMachineId,
        mockUserId,
      );

      expect(result).toEqual({
        enabled: true,
        hireCost: tier1HireCost,
        hireCostFame: tier1HireFame,
        salaryPercent: COLLECTOR_SALARY_PERCENT,
        purchasedAt,
        canPurchase: false,
        alreadyPurchased: true,
      });
    });

    it('should throw if machine does not belong to user', async () => {
      const mockMachine = createMockMachine({ userId: 'other-user' });
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      await expect(
        service.getAutoCollectInfo(mockMachineId, mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('purchaseAutoCollect', () => {
    it('should successfully purchase Auto Collect with FORTUNE', async () => {
      const mockMachine = createMockMachine();
      const mockUser = createMockUser(100);

      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const updatedMachine = {
        ...mockMachine,
        autoCollectEnabled: true,
        autoCollectPurchasedAt: new Date(),
      };
      const updatedUser = {
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(100 - tier1HireCost),
      };

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          user: { update: jest.fn().mockResolvedValue(updatedUser) },
          machine: { update: jest.fn().mockResolvedValue(updatedMachine) },
          transaction: { create: jest.fn() },
        });
      });

      const result = await service.purchaseAutoCollect(
        mockMachineId,
        mockUserId,
      );

      expect(result.cost).toBe(tier1HireCost);
      expect(result.machine.autoCollectEnabled).toBe(true);
      expect(result.newBalance).toBe(100 - tier1HireCost);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if machine is expired', async () => {
      const mockMachine = createMockMachine({ status: 'expired' });
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      await expect(
        service.purchaseAutoCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('Cannot hire collector for expired machine');
    });

    it('should throw if Auto Collect already purchased', async () => {
      const mockMachine = createMockMachine({ autoCollectEnabled: true });
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      await expect(
        service.purchaseAutoCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('Collector already hired');
    });

    it('should throw if insufficient balance', async () => {
      const mockMachine = createMockMachine();
      const mockUser = createMockUser(0.01); // Not enough
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      // $transaction calls purchaseWithFortune which checks balance
      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          user: {
            update: jest
              .fn()
              .mockRejectedValue(
                new BadRequestException('Insufficient balance'),
              ),
          },
          machine: { update: jest.fn() },
          transaction: { create: jest.fn() },
        });
      });

      await expect(
        service.purchaseAutoCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('Insufficient balance');
    });

    it('should throw if user not found', async () => {
      const mockMachine = createMockMachine();
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      prismaService.user.findUnique.mockResolvedValue(null);

      await expect(
        service.purchaseAutoCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('User not found');
    });
  });

  describe('shouldAutoCollect', () => {
    it('should return true when Auto Collect is enabled and coin box is full', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: true,
        status: 'active',
      });

      machinesService.calculateIncome.mockResolvedValue({
        accumulated: 5,
        coinBoxCurrent: 0.64,
        isFull: true,
        canCollect: true,
        secondsUntilFull: 0,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 4.5,
        principalRemaining: 10,
      });

      const result = await service.shouldAutoCollect(mockMachine as any);

      expect(result).toBe(true);
    });

    it('should return false when Auto Collect is disabled', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: false,
      });

      const result = await service.shouldAutoCollect(mockMachine as any);

      expect(result).toBe(false);
      expect(machinesService.calculateIncome).not.toHaveBeenCalled();
    });

    it('should return false when machine is expired', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: true,
        status: 'expired',
      });

      const result = await service.shouldAutoCollect(mockMachine as any);

      expect(result).toBe(false);
    });

    it('should return false when coin box is not full', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: true,
        status: 'active',
      });

      machinesService.calculateIncome.mockResolvedValue({
        accumulated: 2,
        coinBoxCurrent: 0.32,
        isFull: false,
        canCollect: false,
        secondsUntilFull: 3600,
        currentProfit: 0.32,
        currentPrincipal: 0,
        profitRemaining: 4.5,
        principalRemaining: 10,
      });

      const result = await service.shouldAutoCollect(mockMachine as any);

      expect(result).toBe(false);
    });
  });

  describe('executeAutoCollect', () => {
    it('should execute auto-collect when conditions are met', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: true,
        status: 'active',
      });

      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      machinesService.calculateIncome.mockResolvedValue({
        accumulated: 5,
        coinBoxCurrent: 0.64,
        isFull: true,
        canCollect: true,
        secondsUntilFull: 0,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 4.5,
        principalRemaining: 10,
      });

      machinesService.collectCoins.mockResolvedValue({
        collected: 0.64,
        machine: mockMachine,
      } as any);

      // Mock $transaction to execute the callback
      (prismaService.$transaction as jest.Mock).mockImplementation((cb: any) =>
        cb(prismaService),
      );

      const result = await service.executeAutoCollect(mockMachineId);

      // 0.64 - 5% salary (0.032) = 0.608
      expect(result).toEqual({
        machineId: mockMachineId,
        amountCollected: 0.608,
        success: true,
      });
      expect(machinesService.collectCoins).toHaveBeenCalledWith(
        mockMachineId,
        mockUserId,
        true,
      );
    });

    it('should not execute when conditions are not met', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: false,
      });

      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      const result = await service.executeAutoCollect(mockMachineId);

      expect(result).toEqual({
        machineId: mockMachineId,
        amountCollected: 0,
        success: false,
      });
      expect(machinesService.collectCoins).not.toHaveBeenCalled();
    });

    it('should handle collect errors gracefully', async () => {
      const mockMachine = createMockMachine({
        autoCollectEnabled: true,
        status: 'active',
      });

      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      machinesService.calculateIncome.mockResolvedValue({
        accumulated: 5,
        coinBoxCurrent: 0.64,
        isFull: true,
        canCollect: true,
        secondsUntilFull: 0,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 4.5,
        principalRemaining: 10,
      });

      machinesService.collectCoins.mockRejectedValue(
        new Error('Collection failed'),
      );

      const consoleSpy = jest
        .spyOn(console, 'error')
        .mockImplementation(() => {});

      const result = await service.executeAutoCollect(mockMachineId);

      expect(result).toEqual({
        machineId: mockMachineId,
        amountCollected: 0,
        success: false,
      });
      expect(consoleSpy).toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });

  describe('executeAutoCollectForAll', () => {
    it('should execute auto-collect for all eligible machines', async () => {
      const mockMachine1 = createMockMachine({
        id: 'machine-1',
        autoCollectEnabled: true,
      });
      const mockMachine2 = createMockMachine({
        id: 'machine-2',
        autoCollectEnabled: true,
      });

      prismaService.machine.findMany.mockResolvedValue([
        mockMachine1,
        mockMachine2,
      ] as any);

      machinesService.findByIdOrThrow
        .mockResolvedValueOnce(mockMachine1 as any)
        .mockResolvedValueOnce(mockMachine2 as any);

      machinesService.calculateIncome.mockResolvedValue({
        accumulated: 5,
        coinBoxCurrent: 0.64,
        isFull: true,
        canCollect: true,
        secondsUntilFull: 0,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 4.5,
        principalRemaining: 10,
      });

      machinesService.collectCoins.mockResolvedValue({
        collected: 0.64,
        machine: mockMachine1,
      } as any);

      // Mock $transaction
      (prismaService.$transaction as jest.Mock).mockImplementation((cb: any) =>
        cb(prismaService),
      );

      const results = await service.executeAutoCollectForAll();

      expect(results.length).toBe(2);
      expect(results[0].success).toBe(true);
      expect(results[1].success).toBe(true);
      expect(prismaService.machine.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          autoCollectEnabled: true,
        },
      });
    });

    it('should return empty array if no machines found', async () => {
      prismaService.machine.findMany.mockResolvedValue([]);

      const results = await service.executeAutoCollectForAll();

      expect(results).toEqual([]);
    });
  });
});
