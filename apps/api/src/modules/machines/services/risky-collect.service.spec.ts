import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RiskyCollectService } from './risky-collect.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MachinesService } from '../machines.service';
import {
  GAMBLE_WIN_MULTIPLIER,
  GAMBLE_LOSE_MULTIPLIER,
  FORTUNE_GAMBLE_LEVELS,
} from '@fortune-city/shared';

describe('RiskyCollectService', () => {
  let service: RiskyCollectService;
  let machinesService: jest.Mocked<MachinesService>;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';
  const mockMachineId = 'machine-456';

  const createMockMachine = (overrides = {}) => ({
    id: mockMachineId,
    userId: mockUserId,
    tier: 1,
    purchasePrice: new Prisma.Decimal(10),
    fortuneGambleLevel: 0,
    status: 'active',
    profitPaidOut: new Prisma.Decimal(0),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RiskyCollectService,
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
            user: {
              findUnique: jest.fn(),
            },
            machine: {
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

    service = module.get<RiskyCollectService>(RiskyCollectService);
    machinesService = module.get(MachinesService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('riskyCollect', () => {
    it('should throw if machine does not belong to user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other-user' }) as any,
      );

      await expect(
        service.riskyCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });

    it('should throw if coin box is not full', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      machinesService.calculateIncome.mockResolvedValue({
        canCollect: false,
        secondsUntilFull: 3600,
        coinBoxCurrent: 0.32,
        currentProfit: 0.32,
        currentPrincipal: 0,
        profitRemaining: 3.5,
        principalRemaining: 10,
        accumulated: 3,
        isFull: false,
      });

      await expect(
        service.riskyCollect(mockMachineId, mockUserId),
      ).rejects.toThrow('CoinBox is not full');
    });

    it('should execute risky collect with win/lose multiplier', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine() as any,
      );
      machinesService.calculateIncome.mockResolvedValue({
        canCollect: true,
        secondsUntilFull: 0,
        coinBoxCurrent: 0.64,
        currentProfit: 0.64,
        currentPrincipal: 0,
        profitRemaining: 2.86,
        principalRemaining: 10,
        accumulated: 5,
        isFull: true,
      });

      (prisma.$transaction as jest.Mock).mockImplementation(async (cb) =>
        cb({
          machine: { update: jest.fn().mockResolvedValue(createMockMachine()) },
          user: {
            update: jest
              .fn()
              .mockResolvedValue({ fortuneBalance: new Prisma.Decimal(100) }),
          },
          transaction: { create: jest.fn() },
        }),
      );

      const result = await service.riskyCollect(mockMachineId, mockUserId);

      expect(result.originalAmount).toBe(0.64);
      expect([GAMBLE_WIN_MULTIPLIER, GAMBLE_LOSE_MULTIPLIER]).toContain(
        result.multiplier,
      );
      expect(result.finalAmount).toBe(
        result.originalAmount * result.multiplier,
      );
      expect(typeof result.won).toBe('boolean');
    });
  });

  describe('getGambleInfo', () => {
    it('should return gamble info for machine', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ fortuneGambleLevel: 0 }) as any,
      );

      const info = await service.getGambleInfo(mockMachineId, mockUserId);

      expect(info.currentLevel).toBe(0);
      expect(info.currentWinChance).toBe(FORTUNE_GAMBLE_LEVELS[0].winChance);
      expect(info.canUpgrade).toBe(true);
      expect(info.nextLevel).toBe(1);
    });

    it('should indicate max level reached', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({
          fortuneGambleLevel: FORTUNE_GAMBLE_LEVELS.length - 1,
        }) as any,
      );

      const info = await service.getGambleInfo(mockMachineId, mockUserId);

      expect(info.canUpgrade).toBe(false);
      expect(info.nextLevel).toBeNull();
      expect(info.upgradeCost).toBeNull();
    });

    it('should throw if machine belongs to another user', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ userId: 'other' }) as any,
      );

      await expect(
        service.getGambleInfo(mockMachineId, mockUserId),
      ).rejects.toThrow('Machine does not belong to user');
    });
  });

  describe('upgradeFortuneGamble', () => {
    it('should throw if machine is expired', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ status: 'expired' }) as any,
      );

      await expect(
        service.upgradeFortuneGamble(mockMachineId, mockUserId),
      ).rejects.toThrow('Cannot upgrade expired machine');
    });

    it('should throw if max level reached', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({
          fortuneGambleLevel: FORTUNE_GAMBLE_LEVELS.length - 1,
        }) as any,
      );

      await expect(
        service.upgradeFortuneGamble(mockMachineId, mockUserId),
      ).rejects.toThrow('Maximum Fortune Gamble level reached');
    });

    it('should throw if insufficient balance', async () => {
      machinesService.findByIdOrThrow.mockResolvedValue(
        createMockMachine({ fortuneGambleLevel: 0 }) as any,
      );
      (prisma.user.findUnique as jest.Mock).mockResolvedValue({
        fortuneBalance: new Prisma.Decimal(0),
      });

      await expect(
        service.upgradeFortuneGamble(mockMachineId, mockUserId),
      ).rejects.toThrow('Insufficient balance');
    });
  });
});
