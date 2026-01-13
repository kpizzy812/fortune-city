import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { AutoCollectService } from './auto-collect.service';
import { MachinesService } from '../machines.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { AUTO_COLLECT_COST_PERCENT } from '@fortune-city/shared';

describe('AutoCollectService', () => {
  let service: AutoCollectService;
  let prismaService: jest.Mocked<PrismaService>;
  let machinesService: jest.Mocked<MachinesService>;

  const mockUserId = 'user-123';
  const mockMachineId = 'machine-123';

  const createMockMachine = (overrides = {}) => ({
    id: mockMachineId,
    userId: mockUserId,
    tier: 1,
    purchasePrice: new Prisma.Decimal(10),
    totalYield: new Prisma.Decimal(13.5),
    profitAmount: new Prisma.Decimal(3.5),
    lifespanDays: 7,
    startedAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2026-01-08T00:00:00Z'),
    ratePerSecond: new Prisma.Decimal(0.0000223214),
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
      ],
    }).compile();

    service = module.get<AutoCollectService>(AutoCollectService);
    prismaService = module.get(PrismaService);
    machinesService = module.get(MachinesService);

    jest.clearAllMocks();
  });

  describe('getAutoCollectInfo', () => {
    it('should return info for machine without Auto Collect', async () => {
      const mockMachine = createMockMachine();
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      const result = await service.getAutoCollectInfo(mockMachineId, mockUserId);

      expect(result).toEqual({
        enabled: false,
        cost: 10 * (AUTO_COLLECT_COST_PERCENT / 100), // 1.5 $FORTUNE
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

      const result = await service.getAutoCollectInfo(mockMachineId, mockUserId);

      expect(result).toEqual({
        enabled: true,
        cost: 10 * (AUTO_COLLECT_COST_PERCENT / 100),
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
    it('should successfully purchase Auto Collect', async () => {
      const mockMachine = createMockMachine();
      const mockUser = createMockUser(100); // Достаточно баланса
      const upgradeCost = 10 * (AUTO_COLLECT_COST_PERCENT / 100); // 1.5

      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

      const updatedMachine = {
        ...mockMachine,
        autoCollectEnabled: true,
        autoCollectPurchasedAt: new Date(),
      };
      const updatedUser = {
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(100 - upgradeCost),
      };

      prismaService.$transaction.mockImplementation(async (callback: any) => {
        return callback({
          user: { update: jest.fn().mockResolvedValue(updatedUser) },
          machine: { update: jest.fn().mockResolvedValue(updatedMachine) },
          transaction: { create: jest.fn() },
        });
      });

      const result = await service.purchaseAutoCollect(mockMachineId, mockUserId);

      expect(result.cost).toBe(upgradeCost);
      expect(result.machine.autoCollectEnabled).toBe(true);
      expect(result.newBalance).toBe(100 - upgradeCost);
      expect(prismaService.$transaction).toHaveBeenCalled();
    });

    it('should throw if machine is expired', async () => {
      const mockMachine = createMockMachine({ status: 'expired' });
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      await expect(
        service.purchaseAutoCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('Cannot purchase for expired machine');
    });

    it('should throw if Auto Collect already purchased', async () => {
      const mockMachine = createMockMachine({ autoCollectEnabled: true });
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);

      await expect(
        service.purchaseAutoCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('Auto Collect already purchased');
    });

    it('should throw if insufficient balance', async () => {
      const mockMachine = createMockMachine();
      const mockUser = createMockUser(1); // Недостаточно баланса
      machinesService.findByIdOrThrow.mockResolvedValue(mockMachine as any);
      prismaService.user.findUnique.mockResolvedValue(mockUser as any);

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
        coinBoxCurrent: 0.64, // Full
        isFull: true,
        canCollect: true,
        secondsUntilFull: 0,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 3.5,
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
        coinBoxCurrent: 0.32, // Half full
        isFull: false,
        canCollect: false,
        secondsUntilFull: 3600,
        currentProfit: 0.32,
        currentPrincipal: 0,
        profitRemaining: 3.5,
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
        profitRemaining: 3.5,
        principalRemaining: 10,
      });

      machinesService.collectCoins.mockResolvedValue({
        collected: 0.64,
        machine: mockMachine,
      } as any);

      const result = await service.executeAutoCollect(mockMachineId);

      expect(result).toEqual({
        machineId: mockMachineId,
        amountCollected: 0.64,
        success: true,
      });
      expect(machinesService.collectCoins).toHaveBeenCalledWith(
        mockMachineId,
        mockUserId,
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
        profitRemaining: 3.5,
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

      // Mock shouldAutoCollect для обеих машин
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
        profitRemaining: 3.5,
        principalRemaining: 10,
      });

      machinesService.collectCoins.mockResolvedValue({
        collected: 0.64,
        machine: mockMachine1,
      } as any);

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
