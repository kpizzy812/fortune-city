import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { WithdrawalsService } from './withdrawals.service';
import { PrismaService } from '../prisma/prisma.service';
import { SolanaRpcService } from '../deposits/services/solana-rpc.service';
import { FundSourceService } from '../economy/services/fund-source.service';
import { TreasuryService } from '../treasury/treasury.service';

describe('WithdrawalsService', () => {
  let service: WithdrawalsService;
  let prismaService: jest.Mocked<PrismaService>;
  let fundSourceService: jest.Mocked<FundSourceService>;
  let solanaRpcService: jest.Mocked<SolanaRpcService>;

  const mockUserId = 'user-123';
  const mockWithdrawalId = 'withdrawal-456';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    fortuneBalance: new Prisma.Decimal(1000),
    referralBalance: new Prisma.Decimal(0),
    totalFreshDeposits: new Prisma.Decimal(500),
    totalProfitCollected: new Prisma.Decimal(500),
    maxTierReached: 3,
    maxTierUnlocked: 3,
    currentTaxRate: new Prisma.Decimal(0.35), // 35% tax for tier 3
    taxDiscount: new Prisma.Decimal(0),
    referralCode: 'ABC12345',
    referredById: null,
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  const createMockWithdrawal = (overrides = {}) => ({
    id: mockWithdrawalId,
    userId: mockUserId,
    method: 'wallet_connect' as const,
    chain: 'solana' as const,
    currency: 'USDT_SOL' as const,
    walletAddress: 'So11111111111111111111111111111111111111112',
    requestedAmount: new Prisma.Decimal(100),
    fromFreshDeposit: new Prisma.Decimal(50),
    fromProfit: new Prisma.Decimal(50),
    taxAmount: new Prisma.Decimal(17.5), // 35% of 50 profit
    taxRate: new Prisma.Decimal(0.35),
    netAmount: new Prisma.Decimal(82.5),
    usdtAmount: new Prisma.Decimal(82.5),
    feeSolAmount: new Prisma.Decimal(0.001),
    txSignature: null,
    status: 'pending' as const,
    errorMessage: null,
    processedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WithdrawalsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
            withdrawal: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
            transaction: {
              create: jest.fn(),
              updateMany: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue(null),
          },
        },
        {
          provide: SolanaRpcService,
          useValue: {
            getHotWalletKeypair: jest.fn(),
            getTokenBalance: jest.fn(),
            getConnection: jest.fn(),
            confirmTransaction: jest.fn(),
            transferToken: jest.fn(),
          },
        },
        {
          provide: FundSourceService,
          useValue: {
            calculateSourceBreakdown: jest.fn(),
            recordWithdrawal: jest.fn(),
          },
        },
        {
          provide: TreasuryService,
          useValue: {
            getHotWalletPublicKey: jest.fn(),
            transferFromTreasury: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<WithdrawalsService>(WithdrawalsService);
    prismaService = module.get(PrismaService);
    fundSourceService = module.get(FundSourceService);
    solanaRpcService = module.get(SolanaRpcService);

    jest.clearAllMocks();
  });

  describe('previewWithdrawal', () => {
    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.previewWithdrawal(mockUserId, 100)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should throw BadRequestException if insufficient balance', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createMockUser({ fortuneBalance: new Prisma.Decimal(50) }),
      );

      await expect(service.previewWithdrawal(mockUserId, 100)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.previewWithdrawal(mockUserId, 100)).rejects.toThrow(
        'Insufficient balance',
      );
    });

    it('should calculate correct tax from profit portion only', async () => {
      const user = createMockUser({
        fortuneBalance: new Prisma.Decimal(1000),
        totalFreshDeposits: new Prisma.Decimal(500),
        totalProfitCollected: new Prisma.Decimal(500),
        currentTaxRate: new Prisma.Decimal(0.35),
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(user);

      // 50% fresh, 50% profit breakdown
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 50,
          profitDerived: 50,
        },
      );

      const result = await service.previewWithdrawal(mockUserId, 100);

      expect(result.requestedAmount).toBe(100);
      expect(result.fromFreshDeposit).toBe(50);
      expect(result.fromProfit).toBe(50);
      expect(result.taxRate).toBe(0.35);
      expect(result.taxAmount).toBe(17.5); // 35% of 50 profit
      expect(result.netAmount).toBe(82.5); // 100 - 17.5
      expect(result.usdtAmount).toBe(82.5);
      expect(result.feeSol).toBe(0.001);
    });

    it('should return zero tax if withdrawal is only from fresh deposits', async () => {
      const user = createMockUser({
        fortuneBalance: new Prisma.Decimal(1000),
        totalFreshDeposits: new Prisma.Decimal(1000),
        totalProfitCollected: new Prisma.Decimal(0),
        currentTaxRate: new Prisma.Decimal(0.35),
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(user);

      // 100% fresh deposits
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 100,
          profitDerived: 0,
        },
      );

      const result = await service.previewWithdrawal(mockUserId, 100);

      expect(result.fromFreshDeposit).toBe(100);
      expect(result.fromProfit).toBe(0);
      expect(result.taxAmount).toBe(0);
      expect(result.netAmount).toBe(100);
    });

    it('should calculate higher tax for higher tax rate', async () => {
      const user = createMockUser({
        fortuneBalance: new Prisma.Decimal(1000),
        currentTaxRate: new Prisma.Decimal(0.5), // 50% tax (tier 1)
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(user);

      // All profit
      (fundSourceService.calculateSourceBreakdown as jest.Mock).mockReturnValue(
        {
          freshDeposit: 0,
          profitDerived: 100,
        },
      );

      const result = await service.previewWithdrawal(mockUserId, 100);

      expect(result.taxAmount).toBe(50); // 50% of 100
      expect(result.netAmount).toBe(50); // 100 - 50
    });
  });

  describe('confirmAtomicWithdrawal', () => {
    const txSignature = '5Kj7WkXyGbm1xEhwdnMjzJ9f2Q8kV3rYt6P4sNcL2mHq';

    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.confirmAtomicWithdrawal(
          mockUserId,
          mockWithdrawalId,
          txSignature,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if withdrawal belongs to another user', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        createMockWithdrawal({ userId: 'other-user' }),
      );

      await expect(
        service.confirmAtomicWithdrawal(
          mockUserId,
          mockWithdrawalId,
          txSignature,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmAtomicWithdrawal(
          mockUserId,
          mockWithdrawalId,
          txSignature,
        ),
      ).rejects.toThrow('Withdrawal does not belong to user');
    });

    it('should throw BadRequestException if withdrawal already processed', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        createMockWithdrawal({ status: 'completed' }),
      );

      await expect(
        service.confirmAtomicWithdrawal(
          mockUserId,
          mockWithdrawalId,
          txSignature,
        ),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.confirmAtomicWithdrawal(
          mockUserId,
          mockWithdrawalId,
          txSignature,
        ),
      ).rejects.toThrow('Withdrawal already processed');
    });

    it('should rollback and mark as failed if transaction not confirmed', async () => {
      const withdrawal = createMockWithdrawal();
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        withdrawal,
      );
      (solanaRpcService.confirmTransaction as jest.Mock).mockResolvedValue(
        false,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(prismaService),
      );
      (prismaService.withdrawal.update as jest.Mock).mockResolvedValue({
        ...withdrawal,
        status: 'failed',
        errorMessage: 'Transaction not confirmed',
      });

      const result = await service.confirmAtomicWithdrawal(
        mockUserId,
        mockWithdrawalId,
        txSignature,
      );

      expect(result.status).toBe('failed');
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.withdrawal.update).toHaveBeenCalledWith({
        where: { id: mockWithdrawalId },
        data: {
          status: 'failed',
          errorMessage: 'Transaction not confirmed',
        },
      });
    });

    it('should mark as completed if transaction confirmed', async () => {
      const withdrawal = createMockWithdrawal();
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        withdrawal,
      );
      (solanaRpcService.confirmTransaction as jest.Mock).mockResolvedValue(
        true,
      );
      (prismaService.withdrawal.update as jest.Mock).mockResolvedValue({
        ...withdrawal,
        status: 'completed',
        txSignature,
        processedAt: new Date(),
      });
      (prismaService.transaction.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.confirmAtomicWithdrawal(
        mockUserId,
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
      });
      expect(prismaService.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          type: 'withdrawal',
          status: 'pending',
        },
        data: {
          status: 'completed',
          txHash: txSignature,
        },
      });
    });
  });

  describe('cancelAtomicWithdrawal', () => {
    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.cancelAtomicWithdrawal(mockUserId, mockWithdrawalId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if withdrawal belongs to another user', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        createMockWithdrawal({ userId: 'other-user' }),
      );

      await expect(
        service.cancelAtomicWithdrawal(mockUserId, mockWithdrawalId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelAtomicWithdrawal(mockUserId, mockWithdrawalId),
      ).rejects.toThrow('Withdrawal does not belong to user');
    });

    it('should throw BadRequestException if withdrawal already processed', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        createMockWithdrawal({ status: 'completed' }),
      );

      await expect(
        service.cancelAtomicWithdrawal(mockUserId, mockWithdrawalId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.cancelAtomicWithdrawal(mockUserId, mockWithdrawalId),
      ).rejects.toThrow('Withdrawal already processed');
    });

    it('should rollback balance and mark as cancelled', async () => {
      const withdrawal = createMockWithdrawal();
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        withdrawal,
      );
      (prismaService.$transaction as jest.Mock).mockImplementation((cb) =>
        cb(prismaService),
      );
      (prismaService.withdrawal.update as jest.Mock).mockResolvedValue({
        ...withdrawal,
        status: 'cancelled',
      });
      (prismaService.transaction.updateMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      const result = await service.cancelAtomicWithdrawal(
        mockUserId,
        mockWithdrawalId,
      );

      expect(result.status).toBe('cancelled');
      // Verify rollback was called
      expect(prismaService.$transaction).toHaveBeenCalled();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          fortuneBalance: { increment: withdrawal.requestedAmount },
          totalFreshDeposits: { increment: withdrawal.fromFreshDeposit },
          totalProfitCollected: { increment: withdrawal.fromProfit },
        },
      });
      // Verify withdrawal updated
      expect(prismaService.withdrawal.update).toHaveBeenCalledWith({
        where: { id: mockWithdrawalId },
        data: { status: 'cancelled' },
      });
      // Verify transaction updated
      expect(prismaService.transaction.updateMany).toHaveBeenCalledWith({
        where: {
          userId: mockUserId,
          type: 'withdrawal',
          status: 'pending',
        },
        data: { status: 'cancelled' },
      });
    });
  });

  describe('getUserWithdrawals', () => {
    it('should return list of withdrawals', async () => {
      const withdrawals = [
        createMockWithdrawal({ id: 'w1', status: 'completed' }),
        createMockWithdrawal({ id: 'w2', status: 'pending' }),
      ];
      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue(
        withdrawals,
      );

      const result = await service.getUserWithdrawals(mockUserId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('w1');
      expect(result[1].id).toBe('w2');
      expect(prismaService.withdrawal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        skip: 0,
      });
    });

    it('should apply limit and offset', async () => {
      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue([]);

      await service.getUserWithdrawals(mockUserId, 10, 5);

      expect(prismaService.withdrawal.findMany).toHaveBeenCalledWith({
        where: { userId: mockUserId },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 5,
      });
    });

    it('should return empty array if no withdrawals', async () => {
      (prismaService.withdrawal.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.getUserWithdrawals(mockUserId);

      expect(result).toEqual([]);
    });
  });

  describe('getWithdrawalById', () => {
    it('should throw NotFoundException if withdrawal not found', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(
        service.getWithdrawalById(mockUserId, mockWithdrawalId),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if withdrawal belongs to another user', async () => {
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        createMockWithdrawal({ userId: 'other-user' }),
      );

      await expect(
        service.getWithdrawalById(mockUserId, mockWithdrawalId),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.getWithdrawalById(mockUserId, mockWithdrawalId),
      ).rejects.toThrow('Withdrawal does not belong to user');
    });

    it('should return withdrawal if found and belongs to user', async () => {
      const withdrawal = createMockWithdrawal();
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        withdrawal,
      );

      const result = await service.getWithdrawalById(
        mockUserId,
        mockWithdrawalId,
      );

      expect(result.id).toBe(mockWithdrawalId);
      expect(result.status).toBe('pending');
      expect(result.requestedAmount).toBe(100);
      expect(result.netAmount).toBe(82.5);
      expect(result.taxAmount).toBe(17.5);
    });
  });

  describe('mapWithdrawalToResponse', () => {
    it('should correctly map all fields', async () => {
      const withdrawal = createMockWithdrawal({
        txSignature: 'test-sig-123',
        processedAt: new Date('2024-01-15T12:00:00Z'),
      });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        withdrawal,
      );

      const result = await service.getWithdrawalById(
        mockUserId,
        mockWithdrawalId,
      );

      expect(result).toMatchObject({
        id: mockWithdrawalId,
        status: 'pending',
        method: 'wallet_connect',
        requestedAmount: 100,
        netAmount: 82.5,
        usdtAmount: 82.5,
        taxAmount: 17.5,
        txSignature: 'test-sig-123',
      });
      expect(result.createdAt).toBeDefined();
      expect(result.processedAt).toBe('2024-01-15T12:00:00.000Z');
    });

    it('should handle null processedAt', async () => {
      const withdrawal = createMockWithdrawal({ processedAt: null });
      (prismaService.withdrawal.findUnique as jest.Mock).mockResolvedValue(
        withdrawal,
      );

      const result = await service.getWithdrawalById(
        mockUserId,
        mockWithdrawalId,
      );

      expect(result.processedAt).toBeNull();
    });
  });
});
