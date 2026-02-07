import { Test, TestingModule } from '@nestjs/testing';
import { SettingsService } from './settings.service';
import { PrismaService } from '../prisma/prisma.service';

describe('SettingsService', () => {
  let service: SettingsService;
  let prisma: jest.Mocked<PrismaService>;

  const mockSettings = {
    id: 'default',
    maxGlobalTier: 3,
    fameDailyLogin: 10,
    fameStreakBonus: 2,
    fameStreakCap: 20,
    famePerHourByTier: {},
    famePerManualCollect: 5,
    famePurchaseByTier: {},
    fameUpgradeMultiplier: 2,
    fameUnlockCostByTier: {},
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettingsService,
        {
          provide: PrismaService,
          useValue: {
            systemSettings: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<SettingsService>(SettingsService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('getSettings', () => {
    it('should return cached settings if available', async () => {
      // Seed the cache
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      await service.onModuleInit();

      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
      // Should not query DB again (was called once during onModuleInit)
      expect(prisma.systemSettings.findUnique).toHaveBeenCalledTimes(1);
    });

    it('should load from DB if cache is empty', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );

      service.invalidateCache();
      const result = await service.getSettings();

      expect(result).toEqual(mockSettings);
    });

    it('should create default settings if none exist', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.systemSettings.create as jest.Mock).mockResolvedValue({
        ...mockSettings,
        maxGlobalTier: 1,
      });

      const result = await service.getSettings();

      expect(prisma.systemSettings.create).toHaveBeenCalledWith({
        data: {
          id: 'default',
          maxGlobalTier: 1,
        },
      });
      expect(result.maxGlobalTier).toBe(1);
    });
  });

  describe('getMaxGlobalTier', () => {
    it('should return max global tier from settings', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      await service.onModuleInit();

      const result = await service.getMaxGlobalTier();

      expect(result).toBe(3);
    });
  });

  describe('updateMaxGlobalTier', () => {
    it('should update and cache new settings', async () => {
      const updated = { ...mockSettings, maxGlobalTier: 5 };
      (prisma.systemSettings.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateMaxGlobalTier(5);

      expect(result.maxGlobalTier).toBe(5);
      expect(prisma.systemSettings.update).toHaveBeenCalledWith({
        where: { id: 'default' },
        data: { maxGlobalTier: 5 },
      });
    });

    it('should throw for invalid tier', async () => {
      await expect(service.updateMaxGlobalTier(0)).rejects.toThrow(
        'maxGlobalTier must be between 1 and 10',
      );
      await expect(service.updateMaxGlobalTier(11)).rejects.toThrow(
        'maxGlobalTier must be between 1 and 10',
      );
    });
  });

  describe('updateSettings', () => {
    it('should update partial settings', async () => {
      const updated = { ...mockSettings, maxGlobalTier: 7 };
      (prisma.systemSettings.update as jest.Mock).mockResolvedValue(updated);

      const result = await service.updateSettings({ maxGlobalTier: 7 });

      expect(result.maxGlobalTier).toBe(7);
    });
  });

  describe('invalidateCache', () => {
    it('should clear cached settings', async () => {
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      await service.onModuleInit();

      service.invalidateCache();

      // Next getSettings should hit DB
      (prisma.systemSettings.findUnique as jest.Mock).mockResolvedValue(
        mockSettings,
      );
      await service.getSettings();

      expect(prisma.systemSettings.findUnique).toHaveBeenCalledTimes(2);
    });
  });
});
