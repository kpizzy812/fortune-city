import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminUsersService } from './admin-users.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminUsersService', () => {
  let service: AdminUsersService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    fortuneBalance: new Prisma.Decimal(1000),
    referralBalance: new Prisma.Decimal(50),
    totalFreshDeposits: new Prisma.Decimal(500),
    totalProfitCollected: new Prisma.Decimal(500),
    maxTierReached: 3,
    maxTierUnlocked: 3,
    currentTaxRate: new Prisma.Decimal(0.35),
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    isBanned: false,
    bannedAt: null,
    bannedReason: null,
    referralCode: 'ABC12345',
    referredById: null,
    createdAt: new Date('2024-01-01T00:00:00Z'),
    updatedAt: new Date(),
    referredBy: null,
    _count: {
      referrals: 5,
      machines: 10,
    },
    ...overrides,
  });

  const mockUserStats = {
    totalDeposits: 5,
    totalDepositsAmount: 500,
    totalWithdrawals: 2,
    totalWithdrawalsAmount: 100,
    totalMachinesPurchased: 10,
    activeMachines: 8,
    expiredMachines: 2,
    totalReferralEarnings: 50,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminUsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              count: jest.fn(),
              update: jest.fn(),
              groupBy: jest.fn(),
            },
            deposit: {
              aggregate: jest.fn(),
            },
            withdrawal: {
              aggregate: jest.fn(),
            },
            machine: {
              count: jest.fn(),
            },
            referralBonus: {
              aggregate: jest.fn(),
              groupBy: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminUsersService>(AdminUsersService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  const setupUserStatsQueries = () => {
    (prismaService.deposit.aggregate as jest.Mock).mockResolvedValue({
      _count: mockUserStats.totalDeposits,
      _sum: {
        amountUsd: new Prisma.Decimal(mockUserStats.totalDepositsAmount),
      },
    });
    (prismaService.withdrawal.aggregate as jest.Mock).mockResolvedValue({
      _count: mockUserStats.totalWithdrawals,
      _sum: {
        netAmount: new Prisma.Decimal(mockUserStats.totalWithdrawalsAmount),
      },
    });
    (prismaService.machine.count as jest.Mock)
      .mockResolvedValueOnce(mockUserStats.totalMachinesPurchased)
      .mockResolvedValueOnce(mockUserStats.activeMachines)
      .mockResolvedValueOnce(mockUserStats.expiredMachines);
    (prismaService.referralBonus.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: new Prisma.Decimal(mockUserStats.totalReferralEarnings) },
    });
  };

  describe('getUserById', () => {
    it('should return user details with stats', async () => {
      const mockUser = createMockUser();
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      setupUserStatsQueries();

      const result = await service.getUserById(mockUserId);

      expect(result.id).toBe(mockUserId);
      expect(result.telegramId).toBe('123456789');
      expect(result.fortuneBalance).toBe(1000);
      expect(result.stats.totalDeposits).toBe(5);
      expect(result.stats.totalMachinesPurchased).toBe(10);
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getUserById('non-existent')).rejects.toThrow(
        NotFoundException,
      );
      await expect(service.getUserById('non-existent')).rejects.toThrow(
        'User non-existent not found',
      );
    });

    it('should return referrer info if user has referrer', async () => {
      const mockUser = createMockUser({
        referredById: 'referrer-456',
        referredBy: {
          id: 'referrer-456',
          username: 'referrer',
          telegramId: '987654321',
        },
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      setupUserStatsQueries();

      const result = await service.getUserById(mockUserId);

      expect(result.hasReferrer).toBe(true);
      expect(result.referrer).toEqual({
        id: 'referrer-456',
        username: 'referrer',
        telegramId: '987654321',
      });
    });
  });

  describe('banUser', () => {
    const banReason = 'Violation of terms of service';

    it('should ban user and set ban details', async () => {
      const mockUser = createMockUser({ isBanned: false });
      const bannedUser = {
        ...mockUser,
        isBanned: true,
        bannedAt: new Date(),
        bannedReason: banReason,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(bannedUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});
      setupUserStatsQueries();

      const result = await service.banUser(mockUserId, banReason);

      expect(result.isBanned).toBe(true);
      expect(result.bannedReason).toBe(banReason);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          isBanned: true,
          bannedAt: expect.any(Date),
          bannedReason: banReason,
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.banUser('non-existent', banReason)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log the ban action', async () => {
      const mockUser = createMockUser({ isBanned: false });
      const bannedUser = { ...mockUser, isBanned: true };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.update as jest.Mock).mockResolvedValue(bannedUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});
      setupUserStatsQueries();

      await service.banUser(mockUserId, banReason);

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminAction: 'user_banned',
          resource: 'user',
          resourceId: mockUserId,
          oldValue: { isBanned: false },
          newValue: { isBanned: true, reason: banReason },
        }),
      });
    });

    it('should ban user who is already banned (no-op from business logic)', async () => {
      const alreadyBannedUser = createMockUser({
        isBanned: true,
        bannedAt: new Date('2024-01-01'),
        bannedReason: 'Old reason',
      });

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        alreadyBannedUser,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...alreadyBannedUser,
        bannedReason: banReason,
        bannedAt: new Date(),
      });
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});
      setupUserStatsQueries();

      // Should not throw - just update the ban reason
      const result = await service.banUser(mockUserId, banReason);

      expect(result.isBanned).toBe(true);
      expect(result.bannedReason).toBe(banReason);
    });
  });

  describe('unbanUser', () => {
    const unbanNote = 'User appealed and was granted pardon';

    it('should unban user and clear ban details', async () => {
      const bannedUser = createMockUser({
        isBanned: true,
        bannedAt: new Date('2024-01-01'),
        bannedReason: 'Some reason',
      });
      const unbannedUser = {
        ...bannedUser,
        isBanned: false,
        bannedAt: null,
        bannedReason: null,
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        bannedUser,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue(unbannedUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});
      setupUserStatsQueries();

      const result = await service.unbanUser(mockUserId, unbanNote);

      expect(result.isBanned).toBe(false);
      expect(result.bannedAt).toBeNull();
      expect(result.bannedReason).toBeNull();
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          isBanned: false,
          bannedAt: null,
          bannedReason: null,
        },
        include: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.unbanUser('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should log the unban action', async () => {
      const bannedUser = createMockUser({ isBanned: true });
      const unbannedUser = { ...bannedUser, isBanned: false };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        bannedUser,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue(unbannedUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});
      setupUserStatsQueries();

      await service.unbanUser(mockUserId, unbanNote);

      expect(prismaService.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          adminAction: 'user_unbanned',
          resource: 'user',
          resourceId: mockUserId,
          oldValue: { isBanned: true },
          newValue: { isBanned: false, note: unbanNote },
        }),
      });
    });

    it('should work without note', async () => {
      const bannedUser = createMockUser({ isBanned: true });
      const unbannedUser = { ...bannedUser, isBanned: false };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        bannedUser,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue(unbannedUser);
      (prismaService.auditLog.create as jest.Mock).mockResolvedValue({});
      setupUserStatsQueries();

      const result = await service.unbanUser(mockUserId);

      expect(result.isBanned).toBe(false);
    });
  });

  describe('getStats', () => {
    it('should return correct user statistics', async () => {
      (prismaService.user.count as jest.Mock)
        .mockResolvedValueOnce(1000) // total
        .mockResolvedValueOnce(10) // banned
        .mockResolvedValueOnce(300) // with referrer
        .mockResolvedValueOnce(500); // active (with machines)

      (prismaService.user.groupBy as jest.Mock).mockResolvedValue([
        { maxTierReached: 1, _count: 400 },
        { maxTierReached: 2, _count: 300 },
        { maxTierReached: 3, _count: 200 },
        { maxTierReached: 4, _count: 100 },
      ]);

      const result = await service.getStats();

      expect(result.totalUsers).toBe(1000);
      expect(result.bannedUsers).toBe(10);
      expect(result.usersWithReferrer).toBe(300);
      expect(result.activeUsers).toBe(500);
      expect(result.usersByTier[1]).toBe(400);
      expect(result.usersByTier[2]).toBe(300);
      expect(result.usersByTier[3]).toBe(200);
      expect(result.usersByTier[4]).toBe(100);
    });

    it('should handle empty stats', async () => {
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);
      (prismaService.user.groupBy as jest.Mock).mockResolvedValue([]);

      const result = await service.getStats();

      expect(result.totalUsers).toBe(0);
      expect(result.bannedUsers).toBe(0);
      expect(result.usersByTier).toEqual({});
    });
  });

  describe('getUsers', () => {
    it('should return paginated users list', async () => {
      const mockUsers = [
        createMockUser({ id: 'u1' }),
        createMockUser({ id: 'u2' }),
      ];

      (prismaService.user.findMany as jest.Mock).mockResolvedValue(mockUsers);
      (prismaService.user.count as jest.Mock).mockResolvedValue(100);

      const result = await service.getUsers({
        limit: 2,
        offset: 0,
      });

      expect(result.users).toHaveLength(2);
      expect(result.total).toBe(100);
      expect(result.limit).toBe(2);
      expect(result.offset).toBe(0);
    });

    it('should apply search filter', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({ search: 'test' });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { username: { contains: 'test', mode: 'insensitive' } },
            ]),
          }),
        }),
      );
    });

    it('should apply isBanned filter', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({ isBanned: true });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isBanned: true }),
        }),
      );
    });

    it('should apply tier range filter', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({ minTier: 2, maxTier: 4 });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            maxTierReached: { gte: 2, lte: 4 },
          }),
        }),
      );
    });

    it('should apply hasReferrer filter', async () => {
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.user.count as jest.Mock).mockResolvedValue(0);

      await service.getUsers({ hasReferrer: true });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            referredById: { not: null },
          }),
        }),
      );

      await service.getUsers({ hasReferrer: false });

      expect(prismaService.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            referredById: null,
          }),
        }),
      );
    });
  });

  describe('getReferralTree', () => {
    it('should return user referral tree', async () => {
      const mockUser = {
        id: mockUserId,
        username: 'testuser',
        referralCode: 'ABC12345',
      };

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.referralBonus.groupBy as jest.Mock).mockResolvedValue([]);
      (prismaService.referralBonus.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(100) },
      });

      const result = await service.getReferralTree(mockUserId);

      expect(result.user.id).toBe(mockUserId);
      expect(result.user.referralCode).toBe('ABC12345');
      expect(result.tree).toEqual([]);
      expect(result.stats.totalEarned).toBe(100);
    });

    it('should throw NotFoundException if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getReferralTree('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should calculate level counts correctly', async () => {
      const mockUser = {
        id: mockUserId,
        username: 'testuser',
        referralCode: 'ABC12345',
      };

      const level1Referrals = [
        {
          id: 'ref1',
          telegramId: '111',
          username: 'ref1',
          firstName: 'Ref1',
          fortuneBalance: new Prisma.Decimal(100),
          maxTierReached: 2,
          isBanned: false,
          createdAt: new Date(),
          _count: { machines: 5 },
        },
        {
          id: 'ref2',
          telegramId: '222',
          username: 'ref2',
          firstName: 'Ref2',
          fortuneBalance: new Prisma.Decimal(200),
          maxTierReached: 3,
          isBanned: false,
          createdAt: new Date(),
          _count: { machines: 10 },
        },
      ];

      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.user.findMany as jest.Mock)
        .mockResolvedValueOnce(level1Referrals) // level 1
        .mockResolvedValueOnce([]) // level 2 for ref1
        .mockResolvedValueOnce([]); // level 2 for ref2

      (prismaService.referralBonus.groupBy as jest.Mock).mockResolvedValue([]);
      (prismaService.referralBonus.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(0) },
      });

      const result = await service.getReferralTree(mockUserId);

      expect(result.stats.level1Count).toBe(2);
      expect(result.stats.level2Count).toBe(0);
      expect(result.stats.level3Count).toBe(0);
    });
  });
});
