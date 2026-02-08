import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ReferralsService } from './referrals.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import { Prisma } from '@prisma/client';

describe('ReferralsService', () => {
  let service: ReferralsService;
  let prismaService: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';
  const mockReferrerId1 = 'referrer-1';
  const mockReferrerId2 = 'referrer-2';
  const mockReferrerId3 = 'referrer-3';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    telegramId: '123456789',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    fortuneBalance: new Prisma.Decimal(100),
    referralBalance: new Prisma.Decimal(0),
    maxTierReached: 1,
    maxTierUnlocked: 1,
    currentTaxRate: new Prisma.Decimal(0.5),
    referralCode: 'ABC12345',
    referredById: null,
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReferralsService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              findMany: jest.fn(),
              update: jest.fn(),
            },
            referralBonus: {
              create: jest.fn(),
              aggregate: jest.fn(),
            },
            machine: {
              findFirst: jest.fn(),
            },
            $transaction: jest.fn(),
          },
        },
        {
          provide: NotificationsService,
          useValue: {
            notify: jest.fn().mockResolvedValue({}),
          },
        },
      ],
    }).compile();

    service = module.get<ReferralsService>(ReferralsService);
    prismaService = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('processReferralBonus', () => {
    it('should not process bonus if freshDepositAmount is 0', async () => {
      const result = await service.processReferralBonus(
        mockUserId,
        'machine-123',
        new Prisma.Decimal(0),
      );

      expect(result.bonuses).toHaveLength(0);
      expect(result.totalDistributed).toBe(0);
      expect(prismaService.user.findUnique).not.toHaveBeenCalled();
    });

    it('should not process bonus if user has no referrer', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createMockUser({ referredById: null }),
      );

      const result = await service.processReferralBonus(
        mockUserId,
        'machine-123',
        new Prisma.Decimal(100),
      );

      expect(result.bonuses).toHaveLength(0);
      expect(result.totalDistributed).toBe(0);
    });

    it('should process 3 levels of referral bonuses', async () => {
      // Setup referral chain: user -> referrer1 -> referrer2 -> referrer3
      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          createMockUser({ id: mockUserId, referredById: mockReferrerId1 }),
        )
        .mockResolvedValueOnce(
          createMockUser({
            id: mockReferrerId1,
            referredById: mockReferrerId2,
          }),
        )
        .mockResolvedValueOnce(
          createMockUser({
            id: mockReferrerId2,
            referredById: mockReferrerId3,
          }),
        )
        .mockResolvedValueOnce(
          createMockUser({ id: mockReferrerId3, referredById: null }),
        );

      const mockBonus = { id: 'bonus-1', amount: new Prisma.Decimal(5) };
      (prismaService.referralBonus.create as jest.Mock).mockResolvedValue(
        mockBonus,
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue({});

      const freshAmount = new Prisma.Decimal(100);
      const result = await service.processReferralBonus(
        mockUserId,
        'machine-123',
        freshAmount,
      );

      // Should create 3 bonuses (5%, 3%, 1%)
      expect(result.bonuses).toHaveLength(3);

      // Verify bonus amounts: 5% + 3% + 1% = 9% of 100 = 9
      expect(result.totalDistributed).toBe(9);

      // Verify referralBonus.create was called 3 times
      expect(prismaService.referralBonus.create).toHaveBeenCalledTimes(3);

      // Verify user.update was called 3 times to increment referralBalance
      expect(prismaService.user.update).toHaveBeenCalledTimes(3);
    });

    it('should calculate correct bonus amounts for each level', async () => {
      // Setup 2-level chain
      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(
          createMockUser({ id: mockUserId, referredById: mockReferrerId1 }),
        )
        .mockResolvedValueOnce(
          createMockUser({
            id: mockReferrerId1,
            referredById: mockReferrerId2,
          }),
        )
        .mockResolvedValueOnce(
          createMockUser({ id: mockReferrerId2, referredById: null }),
        );

      (prismaService.referralBonus.create as jest.Mock).mockImplementation(
        (data) => ({
          id: 'bonus-id',
          ...data.data,
        }),
      );
      (prismaService.user.update as jest.Mock).mockResolvedValue({});

      const freshAmount = new Prisma.Decimal(1000);
      await service.processReferralBonus(
        mockUserId,
        'machine-123',
        freshAmount,
      );

      // Level 1: 5% of 1000 = 50
      expect(prismaService.referralBonus.create).toHaveBeenNthCalledWith(1, {
        data: expect.objectContaining({
          receiverId: mockReferrerId1,
          level: 1,
          rate: 0.05,
          amount: new Prisma.Decimal(50),
        }),
      });

      // Level 2: 3% of 1000 = 30
      expect(prismaService.referralBonus.create).toHaveBeenNthCalledWith(2, {
        data: expect.objectContaining({
          receiverId: mockReferrerId2,
          level: 2,
          rate: 0.03,
          amount: new Prisma.Decimal(30),
        }),
      });
    });
  });

  describe('getReferralStats', () => {
    it('should throw if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.getReferralStats(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return stats with correct structure', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createMockUser({ referralBalance: new Prisma.Decimal(50) }),
      );
      (prismaService.user.findMany as jest.Mock).mockResolvedValue([]);
      (prismaService.referralBonus.aggregate as jest.Mock).mockResolvedValue({
        _sum: { amount: new Prisma.Decimal(0) },
      });
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.getReferralStats(mockUserId);

      expect(result).toMatchObject({
        totalReferrals: 0,
        activeReferrals: 0,
        byLevel: expect.arrayContaining([
          expect.objectContaining({ level: 1 }),
          expect.objectContaining({ level: 2 }),
          expect.objectContaining({ level: 3 }),
        ]),
        totalEarned: 0,
        referralBalance: 50,
        referralCode: 'ABC12345',
      });
    });
  });

  describe('canWithdrawReferralBalance', () => {
    it('should return true if user has active machine', async () => {
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue({
        id: 'machine-123',
        status: 'active',
      });

      const result = await service.canWithdrawReferralBalance(mockUserId);

      expect(result).toBe(true);
      expect(prismaService.machine.findFirst).toHaveBeenCalledWith({
        where: { userId: mockUserId, status: 'active' },
      });
    });

    it('should return false if user has no active machine', async () => {
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.canWithdrawReferralBalance(mockUserId);

      expect(result).toBe(false);
    });
  });

  describe('withdrawReferralBalance', () => {
    it('should throw if user not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.withdrawReferralBalance(mockUserId)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if user has no active machine', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createMockUser({ referralBalance: new Prisma.Decimal(50) }),
      );
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(service.withdrawReferralBalance(mockUserId)).rejects.toThrow(
        'You need at least one active machine to withdraw referral balance',
      );
    });

    it('should throw if referral balance is 0', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createMockUser({ referralBalance: new Prisma.Decimal(0) }),
      );
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue({
        id: 'machine-123',
      });

      await expect(service.withdrawReferralBalance(mockUserId)).rejects.toThrow(
        'Nothing to withdraw',
      );
    });

    it('should transfer full referralBalance to fortuneBalance', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
        referralBalance: new Prisma.Decimal(50),
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue({
        id: 'machine-123',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(150),
        referralBalance: new Prisma.Decimal(0),
      });

      const result = await service.withdrawReferralBalance(mockUserId);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          referralBalance: { decrement: new Prisma.Decimal(50) },
          fortuneBalance: { increment: new Prisma.Decimal(50) },
        },
      });
      expect(Number(result.fortuneBalance)).toBe(150);
      expect(Number(result.referralBalance)).toBe(0);
    });

    it('should transfer partial amount if specified', async () => {
      const mockUser = createMockUser({
        fortuneBalance: new Prisma.Decimal(100),
        referralBalance: new Prisma.Decimal(50),
      });
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue({
        id: 'machine-123',
      });
      (prismaService.user.update as jest.Mock).mockResolvedValue({
        ...mockUser,
        fortuneBalance: new Prisma.Decimal(120),
        referralBalance: new Prisma.Decimal(30),
      });

      await service.withdrawReferralBalance(mockUserId, 20);

      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          referralBalance: { decrement: new Prisma.Decimal(20) },
          fortuneBalance: { increment: new Prisma.Decimal(20) },
        },
      });
    });

    it('should throw if requested amount exceeds balance', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(
        createMockUser({ referralBalance: new Prisma.Decimal(50) }),
      );
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue({
        id: 'machine-123',
      });

      await expect(
        service.withdrawReferralBalance(mockUserId, 100),
      ).rejects.toThrow('Insufficient referral balance');
    });
  });

  describe('findByReferralCode', () => {
    it('should return user if found', async () => {
      const mockUser = createMockUser();
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

      const result = await service.findByReferralCode('ABC12345');

      expect(result).toEqual(mockUser);
      expect(prismaService.user.findUnique).toHaveBeenCalledWith({
        where: { referralCode: 'ABC12345' },
      });
    });

    it('should return null if not found', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByReferralCode('INVALID');

      expect(result).toBeNull();
    });
  });

  describe('setReferrer', () => {
    it('should throw if referral code is invalid', async () => {
      (prismaService.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.setReferrer(mockUserId, 'INVALID')).rejects.toThrow(
        'Invalid referral code',
      );
    });

    it('should throw if trying to refer self', async () => {
      const mockUser = createMockUser();
      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(mockUser) // findByReferralCode
        .mockResolvedValueOnce(mockUser); // check existing referrer

      await expect(service.setReferrer(mockUserId, 'ABC12345')).rejects.toThrow(
        'Cannot refer yourself',
      );
    });

    it('should throw if referrer already set', async () => {
      const referrer = createMockUser({ id: 'referrer-id' });
      const user = createMockUser({ referredById: 'existing-referrer' });

      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(referrer)
        .mockResolvedValueOnce(user);

      await expect(
        service.setReferrer(mockUserId, referrer.referralCode),
      ).rejects.toThrow('Referrer already set');
    });

    it('should set referrer successfully', async () => {
      const referrer = createMockUser({
        id: 'referrer-id',
        referralCode: 'REF123',
      });
      const user = createMockUser({ referredById: null });
      const updatedUser = { ...user, referredById: referrer.id };

      (prismaService.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(referrer)
        .mockResolvedValueOnce(user);
      (prismaService.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.setReferrer(mockUserId, 'REF123');

      expect(result.referredById).toBe(referrer.id);
      expect(prismaService.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { referredById: referrer.id },
      });
    });
  });

  describe('hasActiveMachineWithFreshDeposit', () => {
    it('should return true if user has machine with fresh deposit', async () => {
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue({
        id: 'machine-123',
        fundSource: { freshDepositAmount: new Prisma.Decimal(100) },
      });

      const result = await service.hasActiveMachineWithFreshDeposit(mockUserId);

      expect(result).toBe(true);
    });

    it('should return false if user has no such machine', async () => {
      (prismaService.machine.findFirst as jest.Mock).mockResolvedValue(null);

      const result = await service.hasActiveMachineWithFreshDeposit(mockUserId);

      expect(result).toBe(false);
    });
  });
});
