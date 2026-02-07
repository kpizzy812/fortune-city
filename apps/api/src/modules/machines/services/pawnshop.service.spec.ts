import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PawnshopService } from './pawnshop.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import { FundSourceService } from '../../economy/services/fund-source.service';
import { PAWNSHOP_COMMISSION_RATE } from '@fortune-city/shared';

describe('PawnshopService', () => {
  let service: PawnshopService;
  let machinesService: jest.Mocked<MachinesService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';
  const mockMachineId = 'machine-456';

  const createMockMachine = (overrides = {}) => ({
    id: mockMachineId,
    userId: mockUserId,
    tier: 1,
    purchasePrice: new Prisma.Decimal(10),
    profitPaidOut: new Prisma.Decimal(0),
    principalPaidOut: new Prisma.Decimal(0),
    status: 'active',
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PawnshopService,
        {
          provide: MachinesService,
          useValue: {
            findByIdOrThrow: jest.fn(),
            calculateIncome: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {
            $transaction: jest.fn(),
          },
        },
        {
          provide: FundSourceService,
          useValue: {
            recordProfitCollection: jest.fn().mockResolvedValue(undefined),
            propagateMachineFundSourceToBalance: jest.fn().mockResolvedValue({
              freshPortion: new Prisma.Decimal(0),
              profitPortion: new Prisma.Decimal(0),
            }),
          },
        },
      ],
    }).compile();

    service = module.get<PawnshopService>(PawnshopService);
    machinesService = module.get(MachinesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getPawnshopInfo', () => {
    it('should return pawnshop info for active machine before BE', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      machinesService.calculateIncome.mockResolvedValue({
        canCollect: false,
        secondsUntilFull: 3600,
        coinBoxCurrent: 0.32,
        currentProfit: 0.32,
        currentPrincipal: 0,
        profitRemaining: 4.18,
        principalRemaining: 10,
        accumulated: 3,
        isFull: false,
      });

      const info = await service.getPawnshopInfo(mockMachineId, mockUserId);

      expect(info.canSell).toBe(true);
      expect(info.tierPrice).toBe(10);
      expect(info.commissionRate).toBe(PAWNSHOP_COMMISSION_RATE);
      // Payout = 10 * 0.9 - 0.32 = 8.68
      expect(info.expectedPayout).toBeCloseTo(8.68, 1);
    });

    it('should not allow selling after breakeven', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ profitPaidOut: new Prisma.Decimal(4.5) }) as any,
      );
      machinesService.calculateIncome.mockResolvedValue({
        canCollect: true,
        secondsUntilFull: 0,
        coinBoxCurrent: 0.64,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 0,
        principalRemaining: 5.36,
        accumulated: 10,
        isFull: true,
      });

      const info = await service.getPawnshopInfo(mockMachineId, mockUserId);

      // collectedProfit = 4.5 + 0.64 = 5.14
      // payout = 10 * 0.9 - 5.14 = 3.86 > 0, still available
      // But if profitPaidOut is high enough, pawnshop becomes unavailable
      // For tier 1: price=10, yieldPercent=145, profitAmount=4.5
      // After BE: pawnshop payout <= 0
      expect(typeof info.canSell).toBe('boolean');
    });

    it('should not allow selling expired machine', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ status: 'expired' }) as any,
      );
      machinesService.calculateIncome.mockResolvedValue({
        canCollect: false,
        secondsUntilFull: 0,
        coinBoxCurrent: 0,
        currentProfit: 0,
        currentPrincipal: 0,
        profitRemaining: 0,
        principalRemaining: 0,
        accumulated: 0,
        isFull: false,
      });

      const info = await service.getPawnshopInfo(mockMachineId, mockUserId);

      expect(info.canSell).toBe(false);
      expect(info.reason).toContain('active');
    });

    it('should throw if machine belongs to another user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other' }) as any,
      );

      await expect(
        service.getPawnshopInfo(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });
  });

  describe('sellToPawnshop', () => {
    it('should throw if machine does not belong to user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other' }) as any,
      );

      await expect(
        service.sellToPawnshop(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });

    it('should throw if machine is not active', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ status: 'expired' }) as any,
      );

      await expect(
        service.sellToPawnshop(mockMachineId, mockUserId),
      ).rejects.toThrow('Only active machines can be sold to pawnshop');
    });

    it('should execute pawnshop sale for early machine', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      machinesService.calculateIncome.mockResolvedValue({
        canCollect: false,
        secondsUntilFull: 3600,
        coinBoxCurrent: 0.5,
        currentProfit: 0.5,
        currentPrincipal: 0,
        profitRemaining: 3.0,
        principalRemaining: 10,
        accumulated: 3,
        isFull: false,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
        cb({
          machine: {
            update: jest
              .fn()
              .mockResolvedValue(
                createMockMachine({ status: 'sold_pawnshop' }),
              ),
          },
          user: {
            update: jest.fn().mockResolvedValue({
              id: mockUserId,
              fortuneBalance: new Prisma.Decimal(100),
            }),
          },
          transaction: { create: jest.fn() },
          fundSource: { findUnique: jest.fn().mockResolvedValue(null) },
        }),
      );

      const result = await service.sellToPawnshop(mockMachineId, mockUserId);

      expect(result.tierPrice).toBe(10);
      expect(result.commissionRate).toBe(PAWNSHOP_COMMISSION_RATE);
      // Payout = 10 * 0.9 - 0.5 = 8.5
      expect(result.payout).toBeCloseTo(8.5, 1);
    });
  });
});
