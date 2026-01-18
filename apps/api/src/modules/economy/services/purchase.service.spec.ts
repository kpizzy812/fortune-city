import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PurchaseService } from './purchase.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../../machines/machines.service';
import { AuctionService } from '../../machines/services/auction.service';
import { TransactionsService } from './transactions.service';
import { FundSourceService } from './fund-source.service';
import { SettingsService } from '../../settings/settings.service';
import { ReferralsService } from '../../referrals/referrals.service';
import { Prisma } from '@prisma/client';

describe('PurchaseService', () => {
  let service: PurchaseService;
  let prismaService: jest.Mocked<PrismaService>;
  let machinesService: jest.Mocked<MachinesService>;
  let transactionsService: jest.Mocked<TransactionsService>;
  let fundSourceService: jest.Mocked<FundSourceService>;
  let settingsService: jest.Mocked<SettingsService>;
  let referralsService: jest.Mocked<ReferralsService>;

  const mockUserId = 'user-123';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    fortuneBalance: new Prisma.Decimal(100),
    referralBalance: new Prisma.Decimal(0),
    totalFreshDeposits: new Prisma.Decimal(100),
    totalProfitCollected: new Prisma.Decimal(0),
    maxTierReached: 1,
    maxTierUnlocked: 1,
    currentTaxRate: new Prisma.Decimal(0.5),
    referralCode: 'ABC123',
    referredById: null,
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockMachine = (overrides = {}) => ({
    id: 'machine-123',
    userId: mockUserId,
    tier: 1,
    purchasePrice: new Prisma.Decimal(10),
    totalYield: new Prisma.Decimal(13.5),
    profitAmount: new Prisma.Decimal(3.5),
    lifespanDays: 7,
    startedAt: new Date(),
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    ratePerSecond: new Prisma.Decimal(0.0000223214),
    accumulatedIncome: new Prisma.Decimal(0),
    lastCalculatedAt: new Date(),
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

  const createMockTransaction = (overrides = {}) => ({
    id: 'tx-123',
    userId: mockUserId,
    machineId: 'machine-123',
    type: 'machine_purchase' as const,
    amount: new Prisma.Decimal(10),
    currency: 'FORTUNE' as const,
    taxAmount: new Prisma.Decimal(0),
    taxRate: new Prisma.Decimal(0),
    netAmount: new Prisma.Decimal(10),
    fromFreshDeposit: new Prisma.Decimal(10),
    fromProfit: new Prisma.Decimal(0),
    chain: null,
    txHash: null,
    status: 'completed' as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const mockPrisma = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      machine: {
        findFirst: jest.fn(),
        count: jest.fn().mockResolvedValue(0), // Default: no previous machines
      },
      $transaction: jest.fn(),
    };

    const mockMachinesService = {
      create: jest.fn(),
    };

    const mockTransactionsService = {
      create: jest.fn(),
      findByUserId: jest.fn(),
    };

    const mockFundSourceService = {
      calculateSourceBreakdown: jest.fn(),
      create: jest.fn(),
    };

    const mockSettingsService = {
      getMaxGlobalTier: jest.fn().mockResolvedValue(1), // Default tier 1 available
    };

    const mockReferralsService = {
      processReferralBonus: jest.fn().mockResolvedValue({
        bonuses: [],
        totalDistributed: 0,
      }),
    };

    const mockAuctionService = {
      getFirstPendingListing: jest.fn().mockResolvedValue(null),
      processAuctionSale: jest.fn().mockResolvedValue({
        sellerPayout: 0,
        sellerNewBalance: 0,
      }),
      applyUpgradesToMachine: jest.fn().mockResolvedValue({}),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PurchaseService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: MachinesService, useValue: mockMachinesService },
        { provide: AuctionService, useValue: mockAuctionService },
        { provide: TransactionsService, useValue: mockTransactionsService },
        { provide: FundSourceService, useValue: mockFundSourceService },
        { provide: SettingsService, useValue: mockSettingsService },
        { provide: ReferralsService, useValue: mockReferralsService },
      ],
    }).compile();

    service = module.get<PurchaseService>(PurchaseService);
    prismaService = module.get(PrismaService);
    machinesService = module.get(MachinesService);
    transactionsService = module.get(TransactionsService);
    fundSourceService = module.get(FundSourceService);
    settingsService = module.get(SettingsService);
    referralsService = module.get(ReferralsService);

    jest.clearAllMocks();
  });

  describe('purchaseMachine', () => {
    it('should successfully purchase a tier 1 machine', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
      });
      const mockMachine = createMockMachine();
      const mockTransaction = createMockTransaction();
      const updatedUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(90),
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 10,
          profitDerived: 0,
          totalAmount: 10,
          profitPercentage: 0,
        },
      );

      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            user: {
              update: jest.fn().mockResolvedValue(updatedUser),
            },
          };
          machinesService.create.mockResolvedValue(mockMachine);
          fundSourceService.create.mockResolvedValue({
            id: 'fs-123',
            machineId: mockMachine.id,
            freshDepositAmount: new Prisma.Decimal(10),
            profitDerivedAmount: new Prisma.Decimal(0),
            sourceMachineIds: [],
            createdAt: new Date(),
          });
          transactionsService.create.mockResolvedValue(mockTransaction);

          return callback(mockTx);
        },
      );

      const result = await service.purchaseMachine(mockUserId, { tier: 1 });

      expect(result.machine).toEqual(mockMachine);
      expect(result.transaction).toEqual(mockTransaction);
      expect(result.user).toEqual(updatedUser);
      // reinvestRound is now calculated automatically (1 for first machine)
      expect(machinesService.create).toHaveBeenCalledWith(mockUserId, {
        tier: 1,
        reinvestRound: 1,
      });
    });

    it('should throw BadRequestException for insufficient balance', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(5),
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.purchaseMachine(mockUserId, { tier: 1 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.purchaseMachine(mockUserId, { tier: 1 }),
      ).rejects.toThrow(/Insufficient balance/);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.purchaseMachine(mockUserId, { tier: 1 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException for locked tier', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(1000),
        maxTierReached: 1, // Can only buy tier 1 or 2
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      await expect(
        service.purchaseMachine(mockUserId, { tier: 5 }),
      ).rejects.toThrow(BadRequestException);

      await expect(
        service.purchaseMachine(mockUserId, { tier: 5 }),
      ).rejects.toThrow(/Tier 5 is locked/);
    });

    it('should allow purchasing tier when maxTierUnlocked allows it', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
        maxTierReached: 1,
        maxTierUnlocked: 2, // User has unlocked tier 2
      });
      const mockMachine = createMockMachine({ tier: 2 });
      const mockTransaction = createMockTransaction();
      const updatedUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(70),
        maxTierReached: 2,
        maxTierUnlocked: 2,
        currentTaxRate: new Prisma.Decimal(0.5),
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 30,
          profitDerived: 0,
          totalAmount: 30,
          profitPercentage: 0,
        },
      );

      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            user: {
              update: jest.fn().mockResolvedValue(updatedUser),
            },
          };
          machinesService.create.mockResolvedValue(mockMachine);
          fundSourceService.create.mockResolvedValue({
            id: 'fs-123',
            machineId: mockMachine.id,
            freshDepositAmount: new Prisma.Decimal(30),
            profitDerivedAmount: new Prisma.Decimal(0),
            sourceMachineIds: [],
            createdAt: new Date(),
          });
          transactionsService.create.mockResolvedValue(mockTransaction);

          return callback(mockTx);
        },
      );

      const result = await service.purchaseMachine(mockUserId, { tier: 2 });

      expect(result.machine.tier).toBe(2);
    });

    it('should calculate reinvestRound automatically based on completed machines', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
        maxTierReached: 1, // Not upgrading, so reinvestRound should be calculated
      });
      const mockMachine = createMockMachine({ reinvestRound: 3 });
      const mockTransaction = createMockTransaction();
      const updatedUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(90),
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      // Mock 2 completed machines of same tier -> reinvestRound should be 3
      (prismaService.machine.count as jest.Mock).mockResolvedValue(2);
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 10,
          profitDerived: 0,
          totalAmount: 10,
          profitPercentage: 0,
        },
      );

      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            user: {
              update: jest.fn().mockResolvedValue(updatedUser),
            },
          };
          machinesService.create.mockResolvedValue(mockMachine);
          fundSourceService.create.mockResolvedValue({
            id: 'fs-123',
            machineId: mockMachine.id,
            freshDepositAmount: new Prisma.Decimal(10),
            profitDerivedAmount: new Prisma.Decimal(0),
            sourceMachineIds: [],
            createdAt: new Date(),
          });
          transactionsService.create.mockResolvedValue(mockTransaction);

          return callback(mockTx);
        },
      );

      await service.purchaseMachine(mockUserId, { tier: 1 });

      // reinvestRound should be 3 (2 completed + 1)
      expect(machinesService.create).toHaveBeenCalledWith(mockUserId, {
        tier: 1,
        reinvestRound: 3,
      });
    });

    it('should reset reinvestRound to 1 when upgrading to higher tier', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
        maxTierReached: 1, // Buying tier 2 = upgrade
        maxTierUnlocked: 2,
      });
      const mockMachine = createMockMachine({ tier: 2, reinvestRound: 1 });
      const mockTransaction = createMockTransaction();
      const updatedUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(70),
        maxTierReached: 2,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      // Even with completed machines of tier 2, should reset to 1 for upgrade
      (prismaService.machine.count as jest.Mock).mockResolvedValue(5);
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 30,
          profitDerived: 0,
          totalAmount: 30,
          profitPercentage: 0,
        },
      );

      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback: (tx: unknown) => Promise<unknown>) => {
          const mockTx = {
            user: {
              update: jest.fn().mockResolvedValue(updatedUser),
            },
          };
          machinesService.create.mockResolvedValue(mockMachine);
          fundSourceService.create.mockResolvedValue({
            id: 'fs-123',
            machineId: mockMachine.id,
            freshDepositAmount: new Prisma.Decimal(30),
            profitDerivedAmount: new Prisma.Decimal(0),
            sourceMachineIds: [],
            createdAt: new Date(),
          });
          transactionsService.create.mockResolvedValue(mockTransaction);

          return callback(mockTx);
        },
      );

      await service.purchaseMachine(mockUserId, { tier: 2 });

      // reinvestRound should be 1 because it's an upgrade (tier 2 > maxTierReached 1)
      expect(machinesService.create).toHaveBeenCalledWith(mockUserId, {
        tier: 2,
        reinvestRound: 1,
      });
    });
  });

  describe('canAffordTier', () => {
    it('should return canAfford: true when balance is sufficient', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
        maxTierReached: 1,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.canAffordTier(mockUserId, 1);

      expect(result.canAfford).toBe(true);
      expect(result.price).toBe(10);
      expect(result.currentBalance).toBe(100);
      expect(result.shortfall).toBe(0);
      expect(result.tierLocked).toBe(false);
    });

    it('should return canAfford: false when balance is insufficient', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(5),
        maxTierReached: 1,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.canAffordTier(mockUserId, 1);

      expect(result.canAfford).toBe(false);
      expect(result.shortfall).toBe(5);
    });

    it('should return tierLocked: true for inaccessible tier', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(10000),
        maxTierReached: 1,
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.canAffordTier(mockUserId, 5);

      expect(result.tierLocked).toBe(true);
    });

    it('should throw NotFoundException for non-existent user', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.canAffordTier(mockUserId, 1)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getPurchaseHistory', () => {
    it('should return purchase transactions', async () => {
      const mockTransactions = [
        createMockTransaction(),
        createMockTransaction({ id: 'tx-456' }),
      ];

      transactionsService.findByUserId.mockResolvedValue(mockTransactions);

      const result = await service.getPurchaseHistory(mockUserId);

      expect(result).toEqual(mockTransactions);
      expect(transactionsService.findByUserId).toHaveBeenCalledWith(
        mockUserId,
        {
          type: 'machine_purchase',
        },
      );
    });

    it('should pass limit and offset options', async () => {
      transactionsService.findByUserId.mockResolvedValue([]);

      await service.getPurchaseHistory(mockUserId, { limit: 10, offset: 5 });

      expect(transactionsService.findByUserId).toHaveBeenCalledWith(
        mockUserId,
        {
          type: 'machine_purchase',
          limit: 10,
          offset: 5,
        },
      );
    });
  });
});
