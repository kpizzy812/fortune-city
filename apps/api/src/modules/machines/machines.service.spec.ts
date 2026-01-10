import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('MachinesService', () => {
  let service: MachinesService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';

  const createMockMachine = (overrides = {}) => ({
    id: 'machine-123',
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
    status: 'active' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MachinesService,
        {
          provide: PrismaService,
          useValue: {
            machine: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              updateMany: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<MachinesService>(MachinesService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('findById', () => {
    it('should return machine if found', async () => {
      const mockMachine = createMockMachine();
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.findById('machine-123');

      expect(result).toEqual(mockMachine);
      expect(prismaService.machine.findUnique).toHaveBeenCalledWith({
        where: { id: 'machine-123' },
        include: { fundSource: true },
      });
    });

    it('should return null if not found', async () => {
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('non-existent');

      expect(result).toBeNull();
    });
  });

  describe('findByIdOrThrow', () => {
    it('should return machine if found', async () => {
      const mockMachine = createMockMachine();
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.findByIdOrThrow('machine-123');

      expect(result).toEqual(mockMachine);
    });

    it('should throw NotFoundException if not found', async () => {
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.findByIdOrThrow('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('findByUserId', () => {
    it('should return all machines for user', async () => {
      const mockMachines = [
        createMockMachine(),
        createMockMachine({ id: 'machine-456' }),
      ];
      (prismaService.machine.findMany as jest.Mock).mockResolvedValue(
        mockMachines,
      );

      const result = await service.findByUserId(mockUserId);

      expect(result).toEqual(mockMachines);
      expect(prismaService.machine.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        include: { fundSource: true },
      });
    });

    it('should filter by status when provided', async () => {
      const mockMachines = [createMockMachine()];
      (prismaService.machine.findMany as jest.Mock).mockResolvedValue(
        mockMachines,
      );

      await service.findByUserId(mockUserId, 'active');

      expect(prismaService.machine.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'active' },
        orderBy: { createdAt: 'desc' },
        include: { fundSource: true },
      });
    });
  });

  describe('create', () => {
    it('should create machine with tier 1 defaults', async () => {
      const mockCreated = createMockMachine();
      (prismaService.machine.create as jest.Mock).mockResolvedValue(
        mockCreated,
      );

      const result = await service.create(mockUserId, { tier: 1 });

      expect(result).toEqual(mockCreated);
      expect(prismaService.machine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: mockUserId,
          tier: 1,
          purchasePrice: 10,
          lifespanDays: 7,
          reinvestRound: 1,
          profitReductionRate: 0,
          status: 'active',
        }),
      });
    });

    it('should apply profit reduction for reinvest round', async () => {
      const mockCreated = createMockMachine({ reinvestRound: 3 });
      (prismaService.machine.create as jest.Mock).mockResolvedValue(
        mockCreated,
      );

      await service.create(mockUserId, { tier: 1, reinvestRound: 3 });

      expect(prismaService.machine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          reinvestRound: 3,
          profitReductionRate: 0.1, // -10% for round 3
        }),
      });
    });

    it('should create machine with higher tier', async () => {
      const mockCreated = createMockMachine({ tier: 5 });
      (prismaService.machine.create as jest.Mock).mockResolvedValue(
        mockCreated,
      );

      await service.create(mockUserId, { tier: 5 });

      expect(prismaService.machine.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tier: 5,
          purchasePrice: 600,
          lifespanDays: 22,
        }),
      });
    });

    it('should throw error for invalid tier', async () => {
      await expect(service.create(mockUserId, { tier: 11 })).rejects.toThrow(
        'Invalid tier: 11',
      );
    });
  });

  describe('calculateIncome', () => {
    it('should calculate accumulated income for active machine', async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 3600 * 1000); // 1 hour ago
      const mockMachine = createMockMachine({
        startedAt,
        lastCalculatedAt: startedAt,
        expiresAt: new Date(now.getTime() + 6 * 24 * 3600 * 1000), // 6 days from now
        ratePerSecond: new Prisma.Decimal(0.0000223214),
        coinBoxCapacity: new Prisma.Decimal(1),
        coinBoxCurrent: new Prisma.Decimal(0),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      expect(result.ratePerSecond).toBeCloseTo(0.0000223214, 8);
      expect(result.coinBoxCurrent).toBeGreaterThan(0);
      expect(result.isFull).toBe(false);
      expect(result.isExpired).toBe(false);
      expect(result.canCollect).toBe(false); // Not full yet
    });

    it('should cap income at coin box capacity and allow collect', async () => {
      const now = new Date();
      const startedAt = new Date(now.getTime() - 48 * 3600 * 1000); // 48 hours ago
      const mockMachine = createMockMachine({
        startedAt,
        lastCalculatedAt: startedAt,
        expiresAt: new Date(now.getTime() + 5 * 24 * 3600 * 1000),
        ratePerSecond: new Prisma.Decimal(0.0000223214),
        coinBoxCapacity: new Prisma.Decimal(0.1), // Small capacity
        coinBoxCurrent: new Prisma.Decimal(0),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      expect(result.isFull).toBe(true);
      expect(result.coinBoxCurrent).toBe(0.1);
      expect(result.secondsUntilFull).toBe(0);
      expect(result.canCollect).toBe(true); // Full, so can collect
    });

    it('should calculate income for expired machine and allow collect', async () => {
      const now = new Date();
      const expiresAt = new Date(now.getTime() - 3600 * 1000); // Expired 1 hour ago
      const lastCalc = new Date(now.getTime() - 2 * 3600 * 1000); // Last calc 2 hours ago
      const mockMachine = createMockMachine({
        status: 'expired',
        expiresAt,
        lastCalculatedAt: lastCalc,
        accumulatedIncome: new Prisma.Decimal(10),
        coinBoxCurrent: new Prisma.Decimal(0.3),
        ratePerSecond: new Prisma.Decimal(0.0001),
        coinBoxCapacity: new Prisma.Decimal(1),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      expect(result.isExpired).toBe(true);
      expect(result.canCollect).toBe(true); // Expired, so can collect any amount
    });

    it('should return values without recalculation for sold_early machine', async () => {
      const mockMachine = createMockMachine({
        status: 'sold_early',
        accumulatedIncome: new Prisma.Decimal(5),
        coinBoxCurrent: new Prisma.Decimal(0.2),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      expect(result.accumulated).toBe(5);
      expect(result.coinBoxCurrent).toBe(0.2);
      expect(result.isExpired).toBe(true);
      expect(result.canCollect).toBe(true);
    });
  });

  describe('collectCoins', () => {
    it('should throw error if coinBox not full for active machine', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        status: 'active',
        coinBoxCurrent: new Prisma.Decimal(0.1),
        coinBoxCapacity: new Prisma.Decimal(1), // Not full
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      await expect(
        service.collectCoins('machine-123', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });

    it('should collect coins when coinBox is full', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        status: 'active',
        coinBoxCurrent: new Prisma.Decimal(0.64),
        coinBoxCapacity: new Prisma.Decimal(0.64), // Full
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = {
        id: mockUserId,
        fortuneBalance: new Prisma.Decimal(100),
      };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );
      (prismaService.$transaction as jest.Mock) = jest
        .fn()
        .mockImplementation(async (callback) => {
          const mockTx = {
            machine: {
              update: jest.fn().mockResolvedValue({
                ...mockMachine,
                coinBoxCurrent: new Prisma.Decimal(0),
              }),
            },
            user: {
              update: jest.fn().mockResolvedValue({
                ...mockUser,
                fortuneBalance: new Prisma.Decimal(100.64),
              }),
            },
            transaction: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(mockTx);
        });

      const result = await service.collectCoins('machine-123', mockUserId);

      expect(result.collected).toBe(0.64);
      expect(result.newBalance).toBe(100.64);
    });

    it('should allow collect for expired machine with partial coinBox', async () => {
      const now = new Date();
      // Set lastCalculatedAt = expiresAt so no additional income is calculated
      const expiresAt = new Date(now.getTime() - 1000);
      const mockMachine = createMockMachine({
        status: 'expired',
        coinBoxCurrent: new Prisma.Decimal(0.3),
        coinBoxCapacity: new Prisma.Decimal(1),
        lastCalculatedAt: expiresAt, // Already at expiry time
        expiresAt,
      });
      const mockUser = {
        id: mockUserId,
        fortuneBalance: new Prisma.Decimal(50),
      };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );
      (prismaService.$transaction as jest.Mock) = jest
        .fn()
        .mockImplementation(async (callback) => {
          const mockTx = {
            machine: {
              update: jest.fn().mockResolvedValue({
                ...mockMachine,
                coinBoxCurrent: new Prisma.Decimal(0),
              }),
            },
            user: {
              update: jest.fn().mockResolvedValue({
                ...mockUser,
                fortuneBalance: new Prisma.Decimal(50.3),
              }),
            },
            transaction: {
              create: jest.fn().mockResolvedValue({}),
            },
          };
          return callback(mockTx);
        });

      const result = await service.collectCoins('machine-123', mockUserId);

      expect(result.collected).toBe(0.3);
      expect(result.newBalance).toBe(50.3);
    });

    it('should throw error if machine belongs to different user', async () => {
      const mockMachine = createMockMachine({ userId: 'other-user' });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      await expect(
        service.collectCoins('machine-123', mockUserId),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('checkAndExpireMachines', () => {
    it('should expire machines past their expiry date', async () => {
      (prismaService.machine.updateMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      const result = await service.checkAndExpireMachines();

      expect(result).toBe(5);
      expect(prismaService.machine.updateMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiresAt: { lte: expect.any(Date) },
        },
        data: {
          status: 'expired',
        },
      });
    });
  });

  describe('getTiers', () => {
    it('should return all 10 tiers with calculated values', () => {
      const tiers = service.getTiers();

      expect(tiers).toHaveLength(10);
      expect(tiers[0]).toEqual({
        tier: 1,
        name: 'RUSTY LEVER',
        emoji: '🟤',
        imageUrl: '/machines/tier-1.png',
        price: 10,
        lifespanDays: 7,
        yieldPercent: 135,
        profit: 4, // Math.round(10 * 1.35 - 10) = 4 (rounded from 3.5)
        dailyRate: expect.any(Number),
      });
      expect(tiers[9].tier).toBe(10);
      expect(tiers[9].price).toBe(200000);
    });
  });

  describe('enrichWithTierInfo', () => {
    it('should add tier info to machine', () => {
      const mockMachine = createMockMachine();

      const result = service.enrichWithTierInfo(mockMachine);

      expect(result.tierInfo).toEqual({
        name: 'RUSTY LEVER',
        emoji: '🟤',
        imageUrl: '/machines/tier-1.png',
        yieldPercent: 135,
      });
    });
  });
});
