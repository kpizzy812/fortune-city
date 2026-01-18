import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminWithdrawalsService } from './admin-withdrawals.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminWithdrawalsService', () => {
  let service: AdminWithdrawalsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockWithdrawalId = 'withdrawal-123';
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

  const createMockWithdrawal = (overrides = {}) => ({
    id: mockWithdrawalId,
    userId: mockUserId,
    method: 'wallet_connect',
    chain: 'solana',
    currency: 'USDT_SOL',
    walletAddress: 'So11111111111111111111111111111111111111112',
    requestedAmount: new Prisma.Decimal(100),
    fromFreshDeposit: new Prisma.Decimal(50),
    fromProfit: new Prisma.Decimal(50),
    taxAmount: new Prisma.Decimal(17.5),
    taxRate: new Prisma.Decimal(0.35),
    netAmount: new Prisma.Decimal(82.5),
    usdtAmount: new Prisma.Decimal(82.5),
    feeSolAmount: new Prisma.Decimal(0.001),
    txSignature: null,
    status: 'pending' as const,
    errorMessage: null,
    processedAt: null,
    createdAt: new Date('2024-01-15T10:00:00Z'),
    updatedAt: new Date(),
    user: createMockUser(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminWithdrawalsService,
        {
          provide: PrismaService,
          useValue: {
            withdrawal: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              aggregate: jest.fn(),
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

    service = module.get<AdminWithdrawalsService>(AdminWithdrawalsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getWithdrawalById', () => {
    it('should return withdrawal details', async () => {
      const mockWithdrawal = createMockWithdrawal();
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        mockWithdrawal,
      );

      const result = await service.getWithdrawalById(mockWithdrawalId);

      expect(result.id).toBe(mockWithdrawalId);
      expect(result.status).toBe('pending');
      expect(result.requestedAmount).toBe(100);
      expect(result.netAmount).toBe(82.5);
      expect(result.user.telegramId).toBe('123456789');
    });

    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.getWithdrawalById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getWithdrawalById('non-existent')).rejects.toThrow(
        'Withdrawal non-existent not found',
      );
    });
  });

  describe('approveWithdrawal', () => {
    it('should approve pending withdrawal and change status to processing', async () => {
      const pendingWithdrawal = createMockWithdrawal({ status: 'pending' });
      const processingWithdrawal = {
        ...pendingWithdrawal,
        status: 'processing',
      };

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        pendingWithdrawal,
      );
      (prismaService.withdrawal.update as jest.Mock).mockResolvedValue(
        processingWithdrawal,
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.approveWithdrawal(mockWithdrawalId);

      expect(result.status).toBe('processing');
      expect(prismaService.withdrawal.update).toHaveBeenCalledWith({
        where: { id: mockWithdrawalId },
        data: { status: 'processing' },
        include: expect.any(Object),
      });
      expect(prismaService.auditLog.create).toHaveBeenCalled();
    });

    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.approveWithdrawal('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if withdrawal is not pending', async () => {
      const completedWithdrawal = createMockWithdrawal({ status: 'completed' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        completedWithdrawal,
      );

      await expect(service.approveWithdrawal(mockWithdrawalId)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.approveWithdrawal(mockWithdrawalId)).rejects.toThrow(
        'Cannot approve withdrawal with status completed',
      );
    });

    it('should throw BadRequestException if withdrawal is already processing', async () => {
      const processingWithdrawal = createMockWithdrawal({
        status: 'processing',
      });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        processingWithdrawal,
      );

      await expect(service.approveWithdrawal(mockWithdrawalId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw BadRequestException if withdrawal is cancelled', async () => {
      const cancelledWithdrawal = createMockWithdrawal({ status: 'cancelled' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        cancelledWithdrawal,
      );

      await expect(service.approveWithdrawal(mockWithdrawalId)).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('completeWithdrawal', () => {
    const txSignature = '5Kj7WkXyGbm1xEhwdnMjzJ9f2Q8kV3rYt6P4sNcL2mHq';

    it('should complete processing withdrawal with tx signature', async () => {
      const processingWithdrawal = createMockWithdrawal({
        status: 'processing',
      });
      const completedWithdrawal = {
        ...processingWithdrawal,
        status: 'completed',
        txSignature,
        processedAt: new Date(),
      };

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        processingWithdrawal,
      );
      (prismaService.withdrawal.update as jest.Mock).mockResolvedValue(
        completedWithdrawal,
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.completeWithdrawal(
        mockWithdrawalId,
        txSignature,
      );

      expect(result.status).toBe('completed');
      expect(result.txSignature).toBe(txSignature);
      expect(prismaService.withdrawal.update).toHaveBeenCalledWith({
        where: { id: mockWithdrawalId },
        data: {
          status: 'completed',
          txSignature,
          processedAt: expect.any(Date),
        },
        include: expect.any(Object),
      });
    });

    it('should complete pending withdrawal directly', async () => {
      const pendingWithdrawal = createMockWithdrawal({ status: 'pending' });
      const completedWithdrawal = {
        ...pendingWithdrawal,
        status: 'completed',
        txSignature,
      };

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        pendingWithdrawal,
      );
      (prismaService.withdrawal.update as jest.Mock).mockResolvedValue(
        completedWithdrawal,
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.completeWithdrawal(
        mockWithdrawalId,
        txSignature,
      );

      expect(result.status).toBe('completed');
    });

    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.completeWithdrawal('non-existent', txSignature),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if withdrawal is already completed', async () => {
      const completedWithdrawal = createMockWithdrawal({ status: 'completed' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        completedWithdrawal,
      );

      await expect(
        service.completeWithdrawal(mockWithdrawalId, txSignature),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.completeWithdrawal(mockWithdrawalId, txSignature),
      ).rejects.toThrow('Cannot complete withdrawal with status completed');
    });

    it('should throw BadRequestException if withdrawal is cancelled', async () => {
      const cancelledWithdrawal = createMockWithdrawal({ status: 'cancelled' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        cancelledWithdrawal,
      );

      await expect(
        service.completeWithdrawal(mockWithdrawalId, txSignature),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if withdrawal is failed', async () => {
      const failedWithdrawal = createMockWithdrawal({ status: 'failed' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        failedWithdrawal,
      );

      await expect(
        service.completeWithdrawal(mockWithdrawalId, txSignature),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('rejectWithdrawal', () => {
    const reason = 'Suspicious activity detected';

    it('should reject pending withdrawal and refund balance', async () => {
      const pendingWithdrawal = createMockWithdrawal({
        status: 'pending',
        user: createMockUser(),
      });
      const cancelledWithdrawal = {
        ...pendingWithdrawal,
        status: 'cancelled',
        errorMessage: reason,
        processedAt: new Date(),
      };

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        pendingWithdrawal,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: { update: jest.fn().mockResolvedValue({}) },
            withdrawal: {
              update: jest.fn().mockResolvedValue(cancelledWithdrawal),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.rejectWithdrawal(mockWithdrawalId, reason);

      expect(result.status).toBe('cancelled');
      expect(result.errorMessage).toBe(reason);
    });

    it('should refund user balance correctly', async () => {
      const pendingWithdrawal = createMockWithdrawal({
        status: 'pending',
        requestedAmount: new Prisma.Decimal(100),
        fromFreshDeposit: new Prisma.Decimal(60),
        fromProfit: new Prisma.Decimal(40),
      });

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        pendingWithdrawal,
      );

      let userUpdateCall: unknown = null;
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: {
              update: jest.fn().mockImplementation((args) => {
                userUpdateCall = args;
                return {};
              }),
            },
            withdrawal: {
              update: jest.fn().mockResolvedValue({
                ...pendingWithdrawal,
                status: 'cancelled',
              }),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.rejectWithdrawal(mockWithdrawalId, reason);

      expect(userUpdateCall).toMatchObject({
        where: { id: mockUserId },
        data: {
          fortuneBalance: { increment: pendingWithdrawal.requestedAmount },
          totalFreshDeposits: { increment: pendingWithdrawal.fromFreshDeposit },
          totalProfitCollected: { increment: pendingWithdrawal.fromProfit },
        },
      });
    });

    it('should reject processing withdrawal', async () => {
      const processingWithdrawal = createMockWithdrawal({
        status: 'processing',
      });
      const cancelledWithdrawal = {
        ...processingWithdrawal,
        status: 'cancelled',
      };

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        processingWithdrawal,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: { update: jest.fn().mockResolvedValue({}) },
            withdrawal: {
              update: jest.fn().mockResolvedValue(cancelledWithdrawal),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.rejectWithdrawal(mockWithdrawalId, reason);

      expect(result.status).toBe('cancelled');
    });

    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.rejectWithdrawal('non-existent', reason),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if withdrawal is completed', async () => {
      const completedWithdrawal = createMockWithdrawal({ status: 'completed' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        completedWithdrawal,
      );

      await expect(
        service.rejectWithdrawal(mockWithdrawalId, reason),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.rejectWithdrawal(mockWithdrawalId, reason),
      ).rejects.toThrow('Cannot reject withdrawal with status completed');
    });

    it('should throw BadRequestException if withdrawal is already cancelled', async () => {
      const cancelledWithdrawal = createMockWithdrawal({ status: 'cancelled' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        cancelledWithdrawal,
      );

      await expect(
        service.rejectWithdrawal(mockWithdrawalId, reason),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if withdrawal is failed', async () => {
      const failedWithdrawal = createMockWithdrawal({ status: 'failed' });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        failedWithdrawal,
      );

      await expect(
        service.rejectWithdrawal(mockWithdrawalId, reason),
      ).rejects.toThrow(BadRequestException);
    });

    it('should log the rejection action', async () => {
      const pendingWithdrawal = createMockWithdrawal({ status: 'pending' });

      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        pendingWithdrawal,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation(
        async (callback) => {
          const txPrisma = {
            user: { update: jest.fn().mockResolvedValue({}) },
            withdrawal: {
              update: jest.fn().mockResolvedValue({
                ...pendingWithdrawal,
                status: 'cancelled',
              }),
            },
          };
          return callback(txPrisma);
        },
      );
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});

      await service.rejectWithdrawal(mockWithdrawalId, reason);

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminAction: 'withdrawal_rejected',
          resource: 'withdrawal',
          resourceId: mockWithdrawalId,
        }),
      });
    });
  });

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      (prismaService.withdrawal.count as jest.Mock)
        .mockResolvedValueOnce(100) // total
        .mockResolvedValueOnce(10) // pending
        .mockResolvedValueOnce(5) // processing
        .mockResolvedValueOnce(75) // completed
        .mockResolvedValueOnce(5) // failed
        .mockResolvedValueOnce(5); // cancelled

      (prismaService.withdrawal.aggregate as jest.Mock)
        .mockResolvedValueOnce({
          _sum: {
            requestedAmount: new Prisma.Decimal(10000),
            netAmount: new Prisma.Decimal(8500),
            taxAmount: new Prisma.Decimal(1500),
          },
        })
        .mockResolvedValueOnce({
          _count: 3,
          _sum: { netAmount: new Prisma.Decimal(500) },
        });

      const result = await service.getStats();

      expect(result.totalWithdrawals).toBe(100);
      expect(result.pendingCount).toBe(10);
      expect(result.processingCount).toBe(5);
      expect(result.completedCount).toBe(75);
      expect(result.failedCount).toBe(5);
      expect(result.cancelledCount).toBe(5);
      expect(result.totalRequestedAmount).toBe(10000);
      expect(result.totalNetAmount).toBe(8500);
      expect(result.totalTaxCollected).toBe(1500);
      expect(result.todayCount).toBe(3);
      expect(result.todayAmount).toBe(500);
    });

    it('should handle empty stats', async () => {
      (prismaService.withdrawal.count as jest.Mock).mockResolvedValue(0);
      (prismaService.withdrawal.aggregate as jest.Mock).mockResolvedValue({
        _sum: {
          requestedAmount: null,
          netAmount: null,
          taxAmount: null,
        },
        _count: 0,
      });

      const result = await service.getStats();

      expect(result.totalWithdrawals).toBe(0);
      expect(result.totalRequestedAmount).toBe(0);
      expect(result.totalNetAmount).toBe(0);
      expect(result.totalTaxCollected).toBe(0);
    });
  });

  describe('getWithdrawals', () => {
    it('should return paginated withdrawals list', async () => {
      const mockWithdrawals = [
        createMockWithdrawal({ id: 'w1' }),
        createMockWithdrawal({ id: 'w2' }),
      ];

      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue(
        mockWithdrawals,
      );
      (prismaService.withdrawal.count as jest.Mock).mockResolvedValue(10);

      const result = await service.getWithdrawals({
        limit: 2,
        offset: 0,
      });

      expect(result.withdrawals).toHaveLength(2);
      expect(result.total).toBe(10);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('should apply status filter', async () => {
      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.withdrawal.count as jest.Mock).mockResolvedValue(0);

      await service.getWithdrawals({ status: 'pending' });

      expect(prismaService.withdrawal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'pending' }),
        }),
      );
    });

    it('should apply search filter', async () => {
      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.withdrawal.count as jest.Mock).mockResolvedValue(0);

      await service.getWithdrawals({ search: 'test' });

      expect(prismaService.withdrawal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { walletAddress: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should apply date range filter', async () => {
      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.withdrawal.count as jest.Mock).mockResolvedValue(0);

      const dateFrom = new Date('2024-01-01');
      const dateTo = new Date('2024-01-31');

      await service.getWithdrawals({ dateFrom, dateTo });

      expect(prismaService.withdrawal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { gte: dateFrom, lte: dateTo },
          }),
        }),
      );
    });
  });
});
