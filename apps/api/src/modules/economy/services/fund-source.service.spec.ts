import { Test, TestingModule } from '@nestjs/testing';
import { FundSourceService } from './fund-source.service';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';

describe('FundSourceService', () => {
  let service: FundSourceService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FundSourceService,
        {
          provide: PrismaService,
          useValue: {
            fundSource: {
              create: jest.fn(),
              findUnique: jest.fn(),
            },
            user: {
              findUnique: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<FundSourceService>(FundSourceService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('calculateSourceBreakdown', () => {
    it('should calculate 50/50 split', () => {
      const result = service.calculateSourceBreakdown(
        new Prisma.Decimal(1000),
        new Prisma.Decimal(500), // 50% fresh
        100,
      );

      expect(result.freshDeposit).toBe(50);
      expect(result.profitDerived).toBe(50);
      expect(result.totalAmount).toBe(100);
      expect(result.profitPercentage).toBe(50);
    });

    it('should calculate 100% fresh deposits', () => {
      const result = service.calculateSourceBreakdown(
        new Prisma.Decimal(1000),
        new Prisma.Decimal(1000), // all fresh
        200,
      );

      expect(result.freshDeposit).toBe(200);
      expect(result.profitDerived).toBe(0);
      expect(result.profitPercentage).toBe(0);
    });

    it('should calculate 100% profit', () => {
      const result = service.calculateSourceBreakdown(
        new Prisma.Decimal(1000),
        new Prisma.Decimal(0), // no fresh
        100,
      );

      expect(result.freshDeposit).toBe(0);
      expect(result.profitDerived).toBe(100);
      expect(result.profitPercentage).toBe(100);
    });

    it('should return zeros for zero balance', () => {
      const result = service.calculateSourceBreakdown(
        new Prisma.Decimal(0),
        new Prisma.Decimal(0),
        0,
      );

      expect(result.freshDeposit).toBe(0);
      expect(result.profitDerived).toBe(0);
      expect(result.totalAmount).toBe(0);
    });

    it('should clamp fresh ratio to [0, 1]', () => {
      // Edge case: fresh deposits exceed balance
      const result = service.calculateSourceBreakdown(
        new Prisma.Decimal(100),
        new Prisma.Decimal(200), // somehow more fresh than balance
        100,
      );

      expect(result.freshDeposit).toBe(100); // capped at 100%
      expect(result.profitDerived).toBe(0);
    });
  });

  describe('recordProfitCollection', () => {
    it('should increment totalProfitCollected', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.recordProfitCollection('user-1', 50);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totalProfitCollected: { increment: new Prisma.Decimal(50) },
        },
      });
    });

    it('should skip for zero amount', async () => {
      await service.recordProfitCollection('user-1', 0);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should skip for negative amount', async () => {
      await service.recordProfitCollection('user-1', -10);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('recordFreshDeposit', () => {
    it('should increment totalFreshDeposits', async () => {
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      await service.recordFreshDeposit('user-1', 100);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: 'user-1' },
        data: {
          totalFreshDeposits: { increment: new Prisma.Decimal(100) },
        },
      });
    });

    it('should skip for zero amount', async () => {
      await service.recordFreshDeposit('user-1', 0);

      expect(prisma.user.update).not.toHaveBeenCalled();
    });
  });

  describe('propagateMachineFundSourceToBalance', () => {
    it('should propagate proportions from fund source', async () => {
      (prisma.fundSource.findUnique as jest.Mock).mockResolvedValue({
        machineId: 'machine-1',
        freshDepositAmount: new Prisma.Decimal(60), // 60%
        profitDerivedAmount: new Prisma.Decimal(40), // 40%
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.propagateMachineFundSourceToBalance(
        'user-1',
        'machine-1',
        100,
      );

      expect(Number(result.freshPortion)).toBeCloseTo(60);
      expect(Number(result.profitPortion)).toBeCloseTo(40);
    });

    it('should treat as profit if no fund source found', async () => {
      (prisma.fundSource.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.propagateMachineFundSourceToBalance(
        'user-1',
        'machine-1',
        100,
      );

      expect(Number(result.freshPortion)).toBe(0);
      expect(Number(result.profitPortion)).toBe(100);
    });
  });

  describe('recordWithdrawal', () => {
    it('should deduct from profit first', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        totalFreshDeposits: new Prisma.Decimal(500),
        totalProfitCollected: new Prisma.Decimal(300),
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.recordWithdrawal('user-1', 200);

      expect(Number(result.fromProfit)).toBe(200);
      expect(Number(result.fromFresh)).toBe(0);
    });

    it('should overflow to fresh if profit insufficient', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        totalFreshDeposits: new Prisma.Decimal(500),
        totalProfitCollected: new Prisma.Decimal(50),
      });
      (prisma.user.update as jest.Mock).mockResolvedValue({});

      const result = await service.recordWithdrawal('user-1', 200);

      expect(Number(result.fromProfit)).toBe(50);
      expect(Number(result.fromFresh)).toBe(150);
    });

    it('should throw if user not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.recordWithdrawal('user-1', 100)).rejects.toThrow(
        'User user-1 not found',
      );
    });
  });
});
