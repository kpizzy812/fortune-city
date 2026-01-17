import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminDepositsService } from './admin-deposits.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminDepositsService', () => {
  let service: AdminDepositsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockDepositId = 'deposit-123';
  const mockUserId = 'user-456';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    fortuneBalance: new Prisma.Decimal(1000),
    maxTierReached: 3,
    isBanned: false,
    ...overrides,
  });

  const createMockDeposit = (overrides = {}) => ({
    id: mockDepositId,
    userId: mockUserId,
    method: 'wallet_connect',
    chain: 'solana',
    currency: 'USDT_SOL',
    txSignature: '5Kj7WkXyGbm1xEhwdnMjzJ9f2Q8kV3rYt6P4sNcL2mHq',
    amount: new Prisma.Decimal(100),
    amountUsd: new Prisma.Decimal(100),
    rateToUsd: new Prisma.Decimal(1),
    memo: null,
    status: 'pending' as const,
    slot: BigInt(123456789),
    confirmedAt: null,
    creditedAt: null,
    errorMessage: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    user: createMockUser(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminDepositsService,
        {
          provide: PrismaService,
          useValue: {
            deposit: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              aggregate: jest.fn(),
              groupBy: jest.fn(),
            },
            user: {
              update: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminDepositsService>(AdminDepositsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getDepositById', () => {
    it('should return deposit details', async () => {
      const mockDeposit = createMockDeposit();
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        mockDeposit,
      );

      const result = await service.getDepositById(mockDepositId);

      expect(result.id).toBe(mockDepositId);
      expect(result.status).toBe('pending');
      expect(result.amount).toBe(100);
      expect(result.user.telegramId).toBe('123456789');
    });

    it('should throw NotFoundException if deposit not found', async () => {
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getDepositById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getDepositById('non-existent')).rejects.toThrow(
        'Deposit non-existent not found',
      );
    });
  });

  describe('manualCredit', () => {
    const reason = 'Transaction confirmed manually via explorer';

    it('should credit user balance and update deposit status', async () => {
      const pendingDeposit = createMockDeposit({
        status: 'failed',
        amountUsd: new Prisma.Decimal(100),
      });
      const creditedDeposit = {
        ...pendingDeposit,
        status: 'credited',
        creditedAt: new Date(),
      };

      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        pendingDeposit,
      );

      let userUpdateCall: unknown = null;
      let depositUpdateCall: unknown = null;

      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: {
              update: jest.fn().mockImplementation((args) => {
                userUpdateCall = args;
                return {};
              }),
            },
            deposit: {
              update: jest.fn().mockImplementation((args) => {
                depositUpdateCall = args;
                return creditedDeposit;
              }),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.manualCredit(mockDepositId, reason);

      expect(result.status).toBe('credited');
      expect(userUpdateCall).toMatchObject({
        where: { id: mockUserId },
        data: {
          fortuneBalance: { increment: pendingDeposit.amountUsd },
          totalFreshDeposits: { increment: pendingDeposit.amountUsd },
        },
      });
      expect(depositUpdateCall).toMatchObject({
        where: { id: mockDepositId },
        data: {
          status: 'credited',
          creditedAt: expect.any(Date),
        },
      });
    });

    it('should throw NotFoundException if deposit not found', async () => {
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.manualCredit('non-existent', reason),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if deposit already credited', async () => {
      const creditedDeposit = createMockDeposit({ status: 'credited' });
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        creditedDeposit,
      );

      await expect(
        service.manualCredit(mockDepositId, reason),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.manualCredit(mockDepositId, reason),
      ).rejects.toThrow('Deposit already credited');
    });

    it('should log the manual credit action', async () => {
      const failedDeposit = createMockDeposit({ status: 'failed' });

      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        failedDeposit,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: { update: jest.fn().mockResolvedValue({}) },
            deposit: {
              update: jest.fn().mockResolvedValue({
                ...failedDeposit,
                status: 'credited',
              }),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.manualCredit(mockDepositId, reason);

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminAction: 'deposit_manual_credit',
          resource: 'deposit',
          resourceId: mockDepositId,
        }),
      });
    });

    it('should credit confirmed but not yet credited deposit', async () => {
      const confirmedDeposit = createMockDeposit({ status: 'confirmed' });

      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        confirmedDeposit,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: { update: jest.fn().mockResolvedValue({}) },
            deposit: {
              update: jest.fn().mockResolvedValue({
                ...confirmedDeposit,
                status: 'credited',
              }),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.manualCredit(mockDepositId, reason);

      expect(result.status).toBe('credited');
    });

    it('should credit pending deposit', async () => {
      const pendingDeposit = createMockDeposit({ status: 'pending' });

      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        pendingDeposit,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: { update: jest.fn().mockResolvedValue({}) },
            deposit: {
              update: jest.fn().mockResolvedValue({
                ...pendingDeposit,
                status: 'credited',
              }),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.manualCredit(mockDepositId, reason);

      expect(result.status).toBe('credited');
    });
  });

  describe('retryDeposit', () => {
    const note = 'Retrying after RPC issue fixed';

    it('should mark failed deposit as pending for reprocessing', async () => {
      const failedDeposit = createMockDeposit({
        status: 'failed',
        errorMessage: 'RPC timeout',
      });
      const pendingDeposit = {
        ...failedDeposit,
        status: 'pending',
        errorMessage: null,
      };

      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        failedDeposit,
      );
      (prismaService.deposit.update as jest.Mock).mockResolvedValue(
        pendingDeposit,
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.retryDeposit(mockDepositId, note);

      expect(result.status).toBe('pending');
      expect(result.errorMessage).toBeNull();
      expect(prismaService.deposit.update).toHaveBeenCalledWith({
        where: { id: mockDepositId },
        data: {
          status: 'pending',
          errorMessage: null,
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if deposit not found', async () => {
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.retryDeposit('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if deposit is not failed', async () => {
      const pendingDeposit = createMockDeposit({ status: 'pending' });
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        pendingDeposit,
      );

      await expect(service.retryDeposit(mockDepositId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.retryDeposit(mockDepositId)).rejects.toThrow(
        'Cannot retry deposit with status pending',
      );
    });

    it('should throw BadRequestException if deposit is credited', async () => {
      const creditedDeposit = createMockDeposit({ status: 'credited' });
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        creditedDeposit,
      );

      await expect(service.retryDeposit(mockDepositId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if deposit is confirmed', async () => {
      const confirmedDeposit = createMockDeposit({ status: 'confirmed' });
      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        confirmedDeposit,
      );

      await expect(service.retryDeposit(mockDepositId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should log the retry action', async () => {
      const failedDeposit = createMockDeposit({ status: 'failed' });

      (prismaService.deposit.findUnique as jest.Mock).mockResolvedValue(
        failedDeposit,
      );
      (prismaService.deposit.update as jest.Mock).mockResolvedValue({
        ...failedDeposit,
        status: 'pending',
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.retryDeposit(mockDepositId, note);

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminAction: 'deposit_retry',
          resource: 'deposit',
          resourceId: mockDepositId,
        }),
      });
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      (prismaService.deposit.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(5) // pending
        .mockResolvedValueOnce(10) // confirmed
        .mockResolvedValueOnce(80) // credited
        .mockResolvedValueOnce(5); // failed

      (prismaService.deposit.aggregate as jest.Mock)
        .mockResolvedValueOnce({
          _sum: { amountUsd: new Prisma.Decimal(50000) },
        })
        .mockResolvedValueOnce({
          _count: 3,
          _sum: { amountUsd: new Prisma.Decimal(500) },
        });

      (prismaService.deposit.groupBy as jest.Mock).mockResolvedValue([
        { currency: 'USDT_SOL', _count: 70, _sum: { amount: new Prisma.Decimal(35000) } },
        { currency: 'SOL', _count: 10, _sum: { amount: new Prisma.Decimal(100) } },
      ]);

      const result = await service.getStats();

      expect(result.totalDeposits).toBe(100);
      expect(result.pendingCount).toBe(5);
      expect(result.confirmedCount).toBe(10);
      expect(result.creditedCount).toBe(80);
      expect(result.failedCount).toBe(5);
      expect(result.totalAmountUsd).toBe(50000);
      expect(result.todayCount).toBe(3);
      expect(result.todayAmountUsd).toBe(500);
      expect(result.byCurrency).toHaveProperty('USDT_SOL');
      expect(result.byCurrency.USDT_SOL.count).toBe(70);
    });

    it('should handle empty stats', async () => {
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(0);
      (prismaService.deposit.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amountUsd: null },
        _count: 0,
      });
      (prismaService.deposit.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.totalDeposits).toBe(0);
      expect(result.totalAmountUsd).toBe(0);
      expect(result.byCurrency).toEqual({});
    });
  });

  describe('getDeposits', () => {
    it('should return paginated deposits list', async () => {
      const mockDeposits = [
        createMockDeposit({ id: 'd1' }),
        createMockDeposit({ id: 'd2' }),
      ];

      (prismaService.deposit.findMany as jest.Mock).mockResolvedValue(
        mockDeposits,
      );
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(10);

      const result = await service.getDeposits({
        limit: 2,
        offset: 0,
      });

      expect(result.deposits).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('should apply status filter', async () => {
      (prismaService.deposit.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(0);

      await service.getDeposits({ status: 'credited' });

      expect(prismaService.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'credited' }),
        }),
      );
    });

    it('should apply currency filter', async () => {
      (prismaService.deposit.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(0);

      await service.getDeposits({ currency: 'USDT_SOL' });

      expect(prismaService.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ currency: 'USDT_SOL' }),
        }),
      );
    });

    it('should apply search filter', async () => {
      (prismaService.deposit.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(0);

      await service.getDeposits({ search: 'test-sig' });

      expect(prismaService.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { txSignature: { contains: 'test-sig', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      (prismaService.deposit.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await service.getDeposits({ dateFrom, dateTo });

      expect(prismaService.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: dateFrom, lte: dateTo },
          }),
        }),
      );
    });

    it('should not apply status filter for "all"', async () => {
      (prismaService.deposit.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.deposit.count as jest.Mock).mockResolvedValue(0);

      await service.getDeposits({ status: 'all' });

      expect(prismaService.deposit.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ status: expect.anything() }),
        }),
      );
    });
  });
});
