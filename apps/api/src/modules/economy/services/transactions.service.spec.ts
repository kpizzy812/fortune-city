import { Test, TestingModule } from '@nestjs/testing';
import { TransactionsService } from './transactions.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('TransactionsService', () => {
  let service: TransactionsService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionsService,
        {
          provide: PrismaService,
          useValue: {
            transaction: {
              create: jest.fn(),
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
              aggregate: jest.fn(),
              count: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TransactionsService>(TransactionsService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a transaction with all fields', async () => {
      const mockTx = { id: 'tx-1' };
      (prisma.transaction.create as jest.Mock).mockResolvedValue(mockTx);

      const result = await service.create({
        userId: 'user-1',
        machineId: 'machine-1',
        type: 'machine_purchase',
        amount: 100,
        currency: 'FORTUNE',
        netAmount: 100,
      });

      expect(result).toEqual(mockTx);
      expect(prisma.transaction.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          type: 'machine_purchase',
          amount: 100,
          currency: 'FORTUNE',
          netAmount: 100,
          taxAmount: 0,
          taxRate: 0,
          status: 'completed',
        }),
      });
    });

    it('should use provided tx client', async () => {
      const mockClient = {
        transaction: { create: jest.fn().mockResolvedValue({ id: 'tx-2' }) },
      };

      await service.create(
        {
          userId: 'user-1',
          type: 'deposit',
          amount: 50,
          currency: 'USDT',
          netAmount: 50,
        },
        mockClient as any,
      );

      expect(mockClient.transaction.create).toHaveBeenCalled();
      expect(prisma.transaction.create).not.toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('should return transaction if found', async () => {
      const mockTx = { id: 'tx-1', type: 'deposit' };
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(mockTx);

      const result = await service.findById('tx-1');

      expect(result).toEqual(mockTx);
    });

    it('should return null if not found', async () => {
      (prisma.transaction.findUnique as jest.Mock).mockResolvedValue(null);

      expect(await service.findById('nope')).toBeNull();
    });
  });

  describe('findByUserId', () => {
    it('should return transactions for user', async () => {
      const txs = [{ id: 'tx-1' }, { id: 'tx-2' }];
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue(txs);

      const result = await service.findByUserId('user-1');

      expect(result).toHaveLength(2);
      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        orderBy: { createdAt: 'desc' },
        take: undefined,
        skip: undefined,
      });
    });

    it('should filter by type and status', async () => {
      (prisma.transaction.findMany as jest.Mock).mockResolvedValue([]);

      await service.findByUserId('user-1', {
        type: 'deposit',
        status: 'completed',
        limit: 10,
        offset: 5,
      });

      expect(prisma.transaction.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1', type: 'deposit', status: 'completed' },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });
  });

  describe('updateStatus', () => {
    it('should update transaction status', async () => {
      const updated = { id: 'tx-1', status: 'completed' };
      (prisma.transaction.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateStatus('tx-1', 'completed');

      expect(result.status).toBe('completed');
      expect(prisma.transaction.update).toHaveBeenCalledWith({
        where: { id: 'tx-1' },
        data: { status: 'completed' },
      });
    });
  });

  describe('getUserTransactionStats', () => {
    it('should aggregate transaction stats', async () => {
      (prisma.transaction.aggregate as jest.Mock)
        .mockResolvedValueOnce({ _sum: { netAmount: 1000 } }) // deposits
        .mockResolvedValueOnce({ _sum: { netAmount: 200 } }) // withdrawals
        .mockResolvedValueOnce({ _sum: { netAmount: 500 } }); // earnings
      (prisma.transaction.count as jest.Mock).mockResolvedValue(5); // purchases

      const result = await service.getUserTransactionStats('user-1');

      expect(result.totalDeposits).toBe(1000);
      expect(result.totalWithdrawals).toBe(200);
      expect(result.totalMachinesPurchased).toBe(5);
      expect(result.totalEarnings).toBe(500);
    });

    it('should handle null sums as 0', async () => {
      (prisma.transaction.aggregate as jest.Mock).mockResolvedValue({
        _sum: { netAmount: null },
      });
      (prisma.transaction.count as jest.Mock).mockResolvedValue(0);

      const result = await service.getUserTransactionStats('user-1');

      expect(result.totalDeposits).toBe(0);
      expect(result.totalWithdrawals).toBe(0);
      expect(result.totalMachinesPurchased).toBe(0);
      expect(result.totalEarnings).toBe(0);
    });
  });
});
