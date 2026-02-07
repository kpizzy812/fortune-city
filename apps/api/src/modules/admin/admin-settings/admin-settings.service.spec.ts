import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminSettingsService } from './admin-settings.service';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';

describe('AdminSettingsService', () => {
  let service: AdminSettingsService;
  let prisma: jest.Mocked<PrismaService>;
  let settingsService: jest.Mocked<SettingsService>;

  const mockSettings = {
    id: 'default',
    maxGlobalTier: 5,
    minDepositAmounts: { SOL: 0.01, USDT_SOL: 1 },
    minWithdrawalAmount: new Prisma.Decimal(10),
    walletConnectFeeSol: new Prisma.Decimal(0.001),
    pawnshopCommission: new Prisma.Decimal(0.1),
    taxRatesByTier: { '1': 0.5 },
    referralRates: { '1': 0.05 },
    reinvestReduction: { '1': 0 },
    auctionCommissions: {},
    earlySellCommissions: {},
    gambleWinMultiplier: new Prisma.Decimal(2),
    gambleLoseMultiplier: new Prisma.Decimal(0.5),
    gambleLevels: [],
    coinBoxCapacityHours: 8,
    collectorHirePercent: new Prisma.Decimal(10),
    collectorSalaryPercent: new Prisma.Decimal(0.05),
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminSettingsService,
        {
          provide: PrismaService,
          useValue: {
            systemSettings: {
              findUnique: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              create: jest.fn(),
            },
            auditLog: { create: jest.fn() },
          },
        },
        {
          provide: SettingsService,
          useValue: {
            invalidateCache: jest.fn(),
          },
        },
      ],
    }).compile();

    service = module.get<AdminSettingsService>(AdminSettingsService);
    prisma = module.get(PrismaService);
    settingsService = module.get(SettingsService);

    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return formatted settings', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      const result = await service.getSettings();

      expect(result.maxGlobalTier).toBe(5);
      expect(result.minWithdrawalAmount).toBe(10);
      expect(result.gambleWinMultiplier).toBe(2);
      expect(typeof result.createdAt).toBe('string');
    });

    it('should throw if settings not found', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getSettings()).rejects.toThrow(NotFoundException);
    });
  });

  describe('updateSettings', () => {
    it('should update specified fields', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (prisma.systemSettings.update as jest.Mock).mockResolvedValue({
        ...mockSettings,
        maxGlobalTier: 8,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateSettings(
        { maxGlobalTier: 8 },
        'admin@test.com',
      );

      expect(result.maxGlobalTier).toBe(8);
      expect(prisma.systemSettings.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: { maxGlobalTier: 8 },
      });
      expect(settingsService.invalidateCache).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('should throw if settings not found', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateSettings({ maxGlobalTier: 8 }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('resetToDefaults', () => {
    it('should delete and recreate settings', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      (prisma.systemSettings.delete as jest.Mock).mockResolvedValue({});
      (prisma.systemSettings.create as jest.Mock).mockResolvedValue({
        ...mockSettings,
        maxGlobalTier: 1,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.resetToDefaults('admin@test.com');

      expect(result.maxGlobalTier).toBe(1);
      expect(prisma.systemSettings.delete).toHaveBeenCalled();
      expect(prisma.systemSettings.create).toHaveBeenCalled();
      expect(settingsService.invalidateCache).toHaveBeenCalled();
    });

    it('should throw if settings not found', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.resetToDefaults('admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });
});
