import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminTiersService } from './admin-tiers.service';
import { PrismaService } from '../../prisma/prisma.service';
import { TierCacheService } from '../../machines/services/tier-cache.service';

describe('AdminTiersService', () => {
  let service: AdminTiersService;
  let prisma: jest.Mocked<PrismaService>;
  let tierCacheService: jest.Mocked<TierCacheService>;

  const mockTier = {
    id: 'tier-1',
    tier: 1,
    name: 'Rusty Lever',
    emoji: '🎰',
    price: new Prisma.Decimal(10),
    lifespanDays: 3,
    yieldPercent: 145,
    imageUrl: '/t1.png',
    isVisible: true,
    isPubliclyAvailable: true,
    sortOrder: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminTiersService,
        {
          provide: PrismaService,
          useValue: {
            tierConfig: {
              findMany: jest.fn(),
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
              delete: jest.fn(),
              count: jest.fn(),
            },
            machine: { count: jest.fn() },
            auditLog: { create: jest.fn() },
          },
        },
        {
          provide: TierCacheService,
          useValue: {
            invalidateCache: jest.fn().mockResolvedValue(undefined),
          },
        },
      ],
    }).compile();

    service = module.get<AdminTiersService>(AdminTiersService);
    prisma = module.get(PrismaService);
    tierCacheService = module.get(TierCacheService);

    jest.clearAllMocks();
  });

  describe('getAllTiers', () => {
    it('should return all tiers formatted', async () => {
      (prisma.tierConfig.findMany as jest.Mock).mockResolvedValue([mockTier]);

      const tiers = await service.getAllTiers();

      expect(tiers).toHaveLength(1);
      expect(tiers[0].tier).toBe(1);
      expect(tiers[0].price).toBe(10);
      expect(typeof tiers[0].createdAt).toBe('string');
    });
  });

  describe('getTierByNumber', () => {
    it('should return tier by number', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);

      const tier = await service.getTierByNumber(1);

      expect(tier.name).toBe('Rusty Lever');
    });

    it('should throw if tier not found', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getTierByNumber(99)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('createTier', () => {
    it('should create a new tier', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.tierConfig.create as jest.Mock).mockResolvedValue(mockTier);
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.createTier(
        {
          tier: 1,
          name: 'Rusty Lever',
          emoji: '🎰',
          price: 10,
          lifespanDays: 3,
          yieldPercent: 145,
          imageUrl: '/t1.png',
        },
        'admin',
      );

      expect(result.tier).toBe(1);
      expect(tierCacheService.invalidateCache).toHaveBeenCalled();
    });

    it('should throw if tier number already exists', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);

      await expect(
        service.createTier(
          {
            tier: 1,
            name: 'Test',
            emoji: '🎰',
            price: 10,
            lifespanDays: 3,
            yieldPercent: 145,
          },
          'admin',
        ),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateTier', () => {
    it('should update tier fields', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);
      (prisma.tierConfig.update as jest.Mock).mockResolvedValue({
        ...mockTier,
        name: 'Updated Name',
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateTier(
        1,
        { name: 'Updated Name' },
        'admin',
      );

      expect(result.name).toBe('Updated Name');
      expect(tierCacheService.invalidateCache).toHaveBeenCalled();
    });

    it('should throw if tier not found', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.updateTier(99, { name: 'X' }, 'admin'),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('deleteTier', () => {
    it('should soft delete tier if machines exist', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);
      (prisma.machine.count as jest.Mock).mockResolvedValue(5);
      (prisma.tierConfig.update as jest.Mock).mockResolvedValue({
        ...mockTier,
        isVisible: false,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.deleteTier(1, 'admin');

      expect(result.success).toBe(true);
      expect(result.message).toContain('hidden');
      expect(prisma.tierConfig.update).toHaveBeenCalledWith({
        where: { tier: 1 },
        data: { isVisible: false },
      });
    });

    it('should hard delete tier if no machines exist', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);
      (prisma.machine.count as jest.Mock).mockResolvedValue(0);
      (prisma.tierConfig.delete as jest.Mock).mockResolvedValue({});
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.deleteTier(1, 'admin');

      expect(result.success).toBe(true);
      expect(result.message).toContain('deleted');
      expect(prisma.tierConfig.delete).toHaveBeenCalledWith({
        where: { tier: 1 },
      });
    });

    it('should throw if tier not found', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.deleteTier(99, 'admin')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getTierStats', () => {
    it('should return tier statistics', async () => {
      (prisma.tierConfig.count as jest.Mock)
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(8) // visible
        .mockResolvedValueOnce(5); // publiclyAvailable

      const stats = await service.getTierStats();

      expect(stats.total).toBe(10);
      expect(stats.visible).toBe(8);
      expect(stats.hidden).toBe(2);
      expect(stats.publiclyAvailable).toBe(5);
    });
  });

  describe('updateVisibility', () => {
    it('should update tier visibility', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);
      (prisma.tierConfig.update as jest.Mock).mockResolvedValue({
        ...mockTier,
        isVisible: false,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateVisibility(1, false, 'admin');

      expect(result.isVisible).toBe(false);
      expect(tierCacheService.invalidateCache).toHaveBeenCalled();
    });
  });

  describe('updateAvailability', () => {
    it('should update tier public availability', async () => {
      (prisma.tierConfig.findUnique as jest.Mock).mockResolvedValue(mockTier);
      (prisma.tierConfig.update as jest.Mock).mockResolvedValue({
        ...mockTier,
        isPubliclyAvailable: false,
      });
      (prisma.auditLog.create as jest.Mock).mockResolvedValue({});

      const result = await service.updateAvailability(1, false, 'admin');

      expect(result.isPubliclyAvailable).toBe(false);
      expect(tierCacheService.invalidateCache).toHaveBeenCalled();
    });
  });
});
