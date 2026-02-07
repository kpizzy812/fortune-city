import { Test, TestingModule } from '@nestjs/testing';
import { TierCacheService } from './tier-cache.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MACHINE_TIERS } from '@fortune-city/shared';

describe('TierCacheService', () => {
  let service: TierCacheService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TierCacheService,
        {
          provide: PrismaService,
          useValue: {
            tierConfig: {
              findMany: jest.fn().mockResolvedValue([]),
            },
          },
        },
      ],
    }).compile();

    service = module.get<TierCacheService>(TierCacheService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should initialize with fallback tiers if DB is empty', async () => {
      (prisma.tierConfig.findMany as jest.Mock).mockResolvedValue([]);

      await service.onModuleInit();

      const allTiers = service.getAllTiers();
      expect(allTiers.length).toBe(10);
    });

    it('should load tiers from database', async () => {
      const dbTiers = [
        {
          tier: 1,
          name: 'DB TIER 1',
          emoji: '🏪',
          imageUrl: '/t1.png',
          price: 15,
          yieldPercent: 140,
          lifespanDays: 8,
          coinBoxCapacityHours: 12,
          sortOrder: 1,
        },
      ];
      (prisma.tierConfig.findMany as jest.Mock).mockResolvedValue(dbTiers);

      await service.onModuleInit();

      const tier = service.getTier(1);
      expect(tier).toBeDefined();
      expect(tier!.name).toBe('DB TIER 1');
      expect(tier!.price).toBe(15);
    });
  });

  describe('getTier', () => {
    it('should return tier config for valid tier', async () => {
      await service.onModuleInit();

      const tier = service.getTier(1);

      expect(tier).toBeDefined();
      expect(tier!.tier).toBe(1);
    });

    it('should return null for invalid tier', async () => {
      await service.onModuleInit();

      const tier = service.getTier(99);

      expect(tier).toBeNull();
    });
  });

  describe('getTierOrThrow', () => {
    it('should return tier config', async () => {
      await service.onModuleInit();

      const tier = service.getTierOrThrow(1);

      expect(tier.tier).toBe(1);
    });

    it('should throw for invalid tier', async () => {
      await service.onModuleInit();

      expect(() => service.getTierOrThrow(99)).toThrow();
    });
  });

  describe('getAllTiers', () => {
    it('should return all tiers after init', async () => {
      await service.onModuleInit();

      const tiers = service.getAllTiers();

      expect(tiers.length).toBe(10);
      expect(tiers[0].tier).toBe(1);
      expect(tiers[9].tier).toBe(10);
    });
  });
});
