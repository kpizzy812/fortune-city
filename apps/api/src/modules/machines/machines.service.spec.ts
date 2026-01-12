import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { MachinesService } from './machines.service';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { calculateEarlySellCommission } from '@fortune-city/shared';

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

    // NEW: Payout tracking tests
    it('should correctly track profit and principal payouts when no payouts yet', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5), // $3.50 profit
        purchasePrice: new Prisma.Decimal(10), // $10 principal
        profitPaidOut: new Prisma.Decimal(0),
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(2), // $2 in coinBox
        coinBoxCapacity: new Prisma.Decimal(10),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      // Should have payout tracking fields
      expect(result.profitPaidOut).toBe(0);
      expect(result.principalPaidOut).toBe(0);
      expect(result.profitRemaining).toBe(3.5);
      expect(result.principalRemaining).toBe(10);

      // Current coinBox should be all profit (since profit comes first)
      expect(result.currentProfit).toBe(2);
      expect(result.currentPrincipal).toBe(0);
      expect(result.isBreakevenReached).toBe(false);
    });

    it('should correctly split coinBox between profit and principal after partial profit payout', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(2), // $2 of profit already paid
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(3), // $3 in coinBox
        coinBoxCapacity: new Prisma.Decimal(10),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      expect(result.profitPaidOut).toBe(2);
      expect(result.principalPaidOut).toBe(0);
      expect(result.profitRemaining).toBe(1.5); // 3.5 - 2 = 1.5
      expect(result.principalRemaining).toBe(10);

      // $1.5 profit remaining, $3 in coinBox = $1.5 profit + $1.5 principal
      expect(result.currentProfit).toBe(1.5);
      expect(result.currentPrincipal).toBe(1.5);
      expect(result.isBreakevenReached).toBe(false);
    });

    it('should mark breakeven reached when all profit is paid out', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(3.5), // All profit paid
        principalPaidOut: new Prisma.Decimal(2), // Partial principal paid
        coinBoxCurrent: new Prisma.Decimal(5), // $5 in coinBox (all principal now)
        coinBoxCapacity: new Prisma.Decimal(10),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(
        mockMachine,
      );

      const result = await service.calculateIncome('machine-123');

      expect(result.profitPaidOut).toBe(3.5);
      expect(result.principalPaidOut).toBe(2);
      expect(result.profitRemaining).toBe(0);
      expect(result.principalRemaining).toBe(8); // 10 - 2 = 8

      // All coinBox is principal now (profit exhausted)
      expect(result.currentProfit).toBe(0);
      expect(result.currentPrincipal).toBe(5);
      expect(result.isBreakevenReached).toBe(true);
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

    // NEW: Payout tracking tests for collectCoins
    it('should correctly increment profitPaidOut when collecting pure profit', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(0),
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(2), // $2 pure profit
        coinBoxCapacity: new Prisma.Decimal(2),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);

      let updateCallData: any;
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockImplementation((args) => {
              updateCallData = args.data;
              return Promise.resolve({
                ...mockMachine,
                coinBoxCurrent: new Prisma.Decimal(0),
                profitPaidOut: new Prisma.Decimal(2),
              });
            }),
          },
          user: {
            update: jest.fn().mockResolvedValue({
              ...mockUser,
              fortuneBalance: new Prisma.Decimal(102),
            }),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      await service.collectCoins('machine-123', mockUserId);

      // Should increment profitPaidOut by 2, principalPaidOut by 0
      expect(updateCallData.profitPaidOut).toEqual({ increment: 2 });
      expect(updateCallData.principalPaidOut).toEqual({ increment: 0 });
    });

    it('should correctly split payout tracking between profit and principal', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(2), // $1.5 profit remaining
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(3), // $1.5 profit + $1.5 principal
        coinBoxCapacity: new Prisma.Decimal(3),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);

      let updateCallData: any;
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockImplementation((args) => {
              updateCallData = args.data;
              return Promise.resolve(mockMachine);
            }),
          },
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      await service.collectCoins('machine-123', mockUserId);

      // Should increment profitPaidOut by 1.5, principalPaidOut by 1.5
      expect(updateCallData.profitPaidOut).toEqual({ increment: 1.5 });
      expect(updateCallData.principalPaidOut).toEqual({ increment: 1.5 });
    });
  });

  describe('sellMachineEarly', () => {
    it('should sell machine early with 20% commission (0-20% progress to BE)', async () => {
      const now = new Date();
      // Progress: 0.35 / 3.5 = 10% to BE → 20% commission
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(0.35), // 10% progress
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(0.5), // $0.5 profit in coinBox
        coinBoxCapacity: new Prisma.Decimal(1),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockResolvedValue({ ...mockMachine, status: 'sold_early' }),
          },
          user: {
            update: jest.fn().mockResolvedValue({
              ...mockUser,
              fortuneBalance: new Prisma.Decimal(108.5),
            }),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const result = await service.sellMachineEarly('machine-123', mockUserId);

      // Profit remaining: 3.5 - 0.35 = 3.15, in coinBox: 0.5 profit
      // Principal remaining: 10.0, in coinBox: 0 principal
      // Principal not in coinBox: 10 - 0 = 10, commission 20% = 2.0
      // Principal returned: 10 * 0.8 = 8.0
      // Total: 0.5 (coinBox) + 8.0 = 8.5
      expect(result.profitReturned).toBeCloseTo(0.5, 2);
      expect(result.principalReturned).toBeCloseTo(8.0, 2);
      expect(result.totalReturned).toBeCloseTo(8.5, 2);
      expect(result.commission).toBeCloseTo(2.0, 2);
      expect(result.commissionRate).toBe(0.2);
    });

    it('should sell machine early with 35% commission (20-40% progress to BE)', async () => {
      const now = new Date();
      // Progress: 1.2 / 3.5 = 34.3% to BE → 35% commission
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(1.2), // 34% progress
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(2), // $2 profit + $0 principal
        coinBoxCapacity: new Prisma.Decimal(2),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockResolvedValue({ ...mockMachine, status: 'sold_early' }),
          },
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const result = await service.sellMachineEarly('machine-123', mockUserId);

      // Commission should be 35%
      expect(result.commissionRate).toBe(0.35);
      // Principal not in coinBox: 10.0, commission 35% = 3.5
      // Principal returned: 10 * 0.65 = 6.5
      // Total: 2.0 (coinBox) + 6.5 = 8.5
      expect(result.totalReturned).toBeCloseTo(8.5, 2);
      expect(result.commission).toBeCloseTo(3.5, 2);
    });

    it('should sell machine early with 90% commission (80-100% progress to BE)', async () => {
      const now = new Date();
      // Progress: 3.2 / 3.5 = 91.4% to BE → 90% commission
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(3.2), // 91% progress
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(1), // $0.3 profit + $0.7 principal
        coinBoxCapacity: new Prisma.Decimal(1),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockResolvedValue({ ...mockMachine, status: 'sold_early' }),
          },
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const result = await service.sellMachineEarly('machine-123', mockUserId);

      // Commission should be 90%
      expect(result.commissionRate).toBe(0.9);
      // Principal not in coinBox: 10 - 0.7 = 9.3, commission 90% = 8.37
      // Principal returned: 9.3 * 0.1 = 0.93
      // Total: 1.0 (coinBox) + 0.93 = 1.93
      expect(result.totalReturned).toBeCloseTo(1.93, 2);
      expect(result.commission).toBeCloseTo(8.37, 2);
    });

    it('should sell machine early with 100% commission (after BE reached)', async () => {
      const now = new Date();
      // Progress: 3.5 / 3.5 = 100% → 100% commission (principal non-withdrawable)
      const mockMachine = createMockMachine({
        profitAmount: new Prisma.Decimal(3.5),
        purchasePrice: new Prisma.Decimal(10),
        profitPaidOut: new Prisma.Decimal(3.5), // 100% progress (BE reached)
        principalPaidOut: new Prisma.Decimal(2), // Some principal paid
        coinBoxCurrent: new Prisma.Decimal(5), // All principal
        coinBoxCapacity: new Prisma.Decimal(5),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockResolvedValue({ ...mockMachine, status: 'sold_early' }),
          },
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      const result = await service.sellMachineEarly('machine-123', mockUserId);

      // Commission should be 100% (BE reached)
      expect(result.commissionRate).toBe(1.0);
      // Principal not in coinBox: 10 - 2 - 5 = 3, commission 100% = 3
      // Principal returned: 3 * 0 = 0
      // Total: only coinBox = 5.0
      expect(result.totalReturned).toBeCloseTo(5.0, 2);
      expect(result.commission).toBeCloseTo(3.0, 2);
    });

    it('should throw error if trying to sell expired machine', async () => {
      const mockMachine = createMockMachine({ status: 'expired' });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);

      await expect(
        service.sellMachineEarly('machine-123', mockUserId),
      ).rejects.toThrow('Can only sell active machines');
    });

    it('should throw error if machine belongs to different user', async () => {
      const mockMachine = createMockMachine({ userId: 'other-user' });
      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);

      await expect(
        service.sellMachineEarly('machine-123', mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });

    it('should mark machine as sold_early in transaction', async () => {
      const now = new Date();
      const mockMachine = createMockMachine({
        profitPaidOut: new Prisma.Decimal(1),
        principalPaidOut: new Prisma.Decimal(0),
        coinBoxCurrent: new Prisma.Decimal(1),
        lastCalculatedAt: now,
        expiresAt: new Date(now.getTime() + 7 * 24 * 3600 * 1000),
      });
      const mockUser = { id: mockUserId, fortuneBalance: new Prisma.Decimal(100) };

      (prismaService.machine.findUnique as jest.Mock).mockResolvedValue(mockMachine);

      let machineUpdateData: any;
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockImplementation((args) => {
              machineUpdateData = args.data;
              return Promise.resolve({ ...mockMachine, status: 'sold_early' });
            }),
          },
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
          transaction: { create: jest.fn().mockResolvedValue({}) },
        };
        return callback(mockTx);
      });

      await service.sellMachineEarly('machine-123', mockUserId);

      // Should set status to sold_early and reset coinBox
      expect(machineUpdateData.status).toBe('sold_early');
      expect(machineUpdateData.coinBoxCurrent).toBe(0);
    });
  });

  describe('checkAndExpireMachines', () => {
    it('should expire machines past their expiry date', async () => {
      const mockMachines = [
        createMockMachine({ id: 'machine-1', tier: 1 }),
        createMockMachine({ id: 'machine-2', tier: 2 }),
        createMockMachine({ id: 'machine-3', tier: 3 }),
        createMockMachine({ id: 'machine-4', tier: 4 }),
        createMockMachine({ id: 'machine-5', tier: 5 }),
      ];
      const mockUser = { id: mockUserId, maxTierUnlocked: 5 };

      // Add user to each machine
      const machinesWithUser = mockMachines.map((m) => ({ ...m, user: mockUser }));

      (prismaService.machine.findMany as jest.Mock).mockResolvedValue(machinesWithUser);
      (prismaService.$transaction as jest.Mock) = jest.fn().mockImplementation(async (callback) => {
        const mockTx = {
          machine: {
            update: jest.fn().mockResolvedValue({}),
          },
          user: {
            update: jest.fn().mockResolvedValue(mockUser),
          },
        };
        return callback(mockTx);
      });

      const result = await service.checkAndExpireMachines();

      expect(result).toBe(5);
      expect(prismaService.machine.findMany).toHaveBeenCalledWith({
        where: {
          status: 'active',
          expiresAt: { lte: expect.any(Date) },
        },
        include: {
          user: true,
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

  describe('calculateEarlySellCommission', () => {
    it('should return 0.20 (20%) commission for 0-20% progress', () => {
      const profitAmount = 100;
      const profitPaidOut = 0; // 0%
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(0.20);

      const profitPaidOut2 = 10; // 10%
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(0.20);

      const profitPaidOut3 = 19.9; // 19.9%
      expect(calculateEarlySellCommission(profitPaidOut3, profitAmount)).toBe(0.20);
    });

    it('should return 0.35 (35%) commission for 20-40% progress', () => {
      const profitAmount = 100;
      const profitPaidOut = 20; // 20%
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(0.35);

      const profitPaidOut2 = 30; // 30%
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(0.35);

      const profitPaidOut3 = 39.9; // 39.9%
      expect(calculateEarlySellCommission(profitPaidOut3, profitAmount)).toBe(0.35);
    });

    it('should return 0.55 (55%) commission for 40-60% progress', () => {
      const profitAmount = 100;
      const profitPaidOut = 40; // 40%
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(0.55);

      const profitPaidOut2 = 50; // 50%
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(0.55);

      const profitPaidOut3 = 59.9; // 59.9%
      expect(calculateEarlySellCommission(profitPaidOut3, profitAmount)).toBe(0.55);
    });

    it('should return 0.75 (75%) commission for 60-80% progress', () => {
      const profitAmount = 100;
      const profitPaidOut = 60; // 60%
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(0.75);

      const profitPaidOut2 = 70; // 70%
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(0.75);

      const profitPaidOut3 = 79.9; // 79.9%
      expect(calculateEarlySellCommission(profitPaidOut3, profitAmount)).toBe(0.75);
    });

    it('should return 0.90 (90%) commission for 80-100% progress', () => {
      const profitAmount = 100;
      const profitPaidOut = 80; // 80%
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(0.90);

      const profitPaidOut2 = 90; // 90%
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(0.90);

      const profitPaidOut3 = 99.9; // 99.9%
      expect(calculateEarlySellCommission(profitPaidOut3, profitAmount)).toBe(0.90);
    });

    it('should return 1.0 (100%) commission for 100%+ progress (after breakeven)', () => {
      const profitAmount = 100;
      const profitPaidOut = 100; // 100%
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(1.0);

      const profitPaidOut2 = 150; // 150%
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(1.0);
    });

    it('should handle edge case: exactly at tier boundaries', () => {
      const profitAmount = 100;

      expect(calculateEarlySellCommission(20, profitAmount)).toBe(0.35);
      expect(calculateEarlySellCommission(40, profitAmount)).toBe(0.55);
      expect(calculateEarlySellCommission(60, profitAmount)).toBe(0.75);
      expect(calculateEarlySellCommission(80, profitAmount)).toBe(0.90);
      expect(calculateEarlySellCommission(100, profitAmount)).toBe(1.0);
    });

    it('should return 1.0 (100%) when profitAmount is 0 (edge case)', () => {
      const profitAmount = 0;
      const profitPaidOut = 0;
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(1.0);
    });

    it('should work with decimal profitAmount and profitPaidOut', () => {
      const profitAmount = 3.5; // Real profit from tier 1 machine
      const profitPaidOut = 0.69; // 19.7% paid
      expect(calculateEarlySellCommission(profitPaidOut, profitAmount)).toBe(0.20);

      const profitPaidOut2 = 1.75; // 50% paid
      expect(calculateEarlySellCommission(profitPaidOut2, profitAmount)).toBe(0.55);

      const profitPaidOut3 = 3.5; // 100% paid (breakeven)
      expect(calculateEarlySellCommission(profitPaidOut3, profitAmount)).toBe(1.0);
    });
  });
});
