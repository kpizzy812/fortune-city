jest.mock('nanoid', () => ({
  nanoid: jest.fn().mockReturnValue('mock-ref-code'),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { UsersService, TelegramUserData, EmailUserData } from './users.service';
import { PrismaService } from '../prisma/prisma.service';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: jest.Mocked<PrismaService>;

  const mockUserId = 'user-123';

  const createMockUser = (overrides = {}) => ({
    id: mockUserId,
    telegramId: '12345678',
    email: null,
    supabaseId: null,
    web3Address: null,
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    avatarUrl: null,
    fortuneBalance: 100,
    referralBalance: 0,
    totalFreshDeposits: 50,
    totalProfitCollected: 50,
    maxTierReached: 1,
    maxTierUnlocked: 1,
    currentTaxRate: 0.5,
    taxDiscount: 0,
    referralCode: 'ABC12345',
    referredById: null,
    fame: 0,
    totalFameEarned: 0,
    loginStreak: 0,
    lastLoginDate: null,
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    emailVerifiedAt: null,
    language: 'en',
    isBanned: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: {
            user: {
              findUnique: jest.fn(),
              create: jest.fn(),
              update: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  // ============ Telegram Auth ============

  describe('findByTelegramId', () => {
    it('should return user if found', async () => {
      const user = createMockUser();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findByTelegramId('12345678');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { telegramId: '12345678' },
      });
    });

    it('should return null if not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findByTelegramId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('findById', () => {
    it('should return user if found', async () => {
      const user = createMockUser();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findById(mockUserId);

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: mockUserId },
      });
    });

    it('should return null if not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      const result = await service.findById('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('createFromTelegram', () => {
    const telegramUser: TelegramUserData = {
      id: 12345678,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    it('should create user without referrer', async () => {
      const newUser = createMockUser();
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await service.createFromTelegram(telegramUser);

      expect(result).toEqual(newUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: {
          telegramId: '12345678',
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          avatarUrl: undefined,
          referralCode: 'mock-ref-code',
          referredById: undefined,
        },
      });
    });

    it('should create user with valid referrer code', async () => {
      const referrer = createMockUser({
        id: 'referrer-1',
        referralCode: 'REF123',
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(referrer);
      (prisma.user.create as jest.Mock).mockResolvedValue(createMockUser());

      await service.createFromTelegram(telegramUser, 'REF123');

      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { referralCode: 'REF123' },
        select: { id: true },
      });
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referredById: 'referrer-1',
        }),
      });
    });

    it('should create user without referrer if code is invalid', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // referrer not found
      (prisma.user.create as jest.Mock).mockResolvedValue(createMockUser());

      await service.createFromTelegram(telegramUser, 'INVALID');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referredById: undefined,
        }),
      });
    });
  });

  describe('findOrCreateFromTelegram', () => {
    const telegramUser: TelegramUserData = {
      id: 12345678,
      username: 'testuser',
      first_name: 'Test',
      last_name: 'User',
    };

    it('should return existing user and update info', async () => {
      const existingUser = createMockUser();
      const updatedUser = createMockUser({ username: 'updated' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(existingUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.findOrCreateFromTelegram(telegramUser);

      expect(result.isNewUser).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: existingUser.id },
        data: {
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
          avatarUrl: undefined,
        },
      });
    });

    it('should create new user if not found', async () => {
      const newUser = createMockUser();
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await service.findOrCreateFromTelegram(telegramUser);

      expect(result.isNewUser).toBe(true);
      expect(result.user).toEqual(newUser);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  describe('updateMaxTier', () => {
    it('should update tax rate when reaching higher tier', async () => {
      const user = createMockUser({ maxTierReached: 1 });
      const updatedUser = createMockUser({
        maxTierReached: 3,
        currentTaxRate: 0.4,
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.updateMaxTier(mockUserId, 3);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          maxTierReached: 3,
          currentTaxRate: 0.4,
        },
      });
    });

    it('should not update if tier is lower or equal', async () => {
      const user = createMockUser({ maxTierReached: 5 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.updateMaxTier(mockUserId, 3);

      expect(result).toEqual(user);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('should set correct tax rate for tier 10', async () => {
      const user = createMockUser({ maxTierReached: 1 });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue(
        createMockUser({ maxTierReached: 10, currentTaxRate: 0.1 }),
      );

      await service.updateMaxTier(mockUserId, 10);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          maxTierReached: 10,
          currentTaxRate: 0.1,
        },
      });
    });
  });

  // ============ Email Auth ============

  describe('findByEmail', () => {
    it('should return user if found', async () => {
      const user = createMockUser({ email: 'test@test.com' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findByEmail('test@test.com');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { email: 'test@test.com' },
      });
    });

    it('should return null if not found', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

      expect(await service.findByEmail('nope@test.com')).toBeNull();
    });
  });

  describe('findBySupabaseId', () => {
    it('should return user if found', async () => {
      const user = createMockUser({ supabaseId: 'supa-123' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findBySupabaseId('supa-123');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { supabaseId: 'supa-123' },
      });
    });
  });

  describe('createFromEmail', () => {
    const emailUser: EmailUserData = {
      supabaseId: 'supa-123',
      email: 'test@test.com',
      emailVerified: true,
    };

    it('should create user from email', async () => {
      const newUser = createMockUser({ email: 'test@test.com' });
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await service.createFromEmail(emailUser);

      expect(result).toEqual(newUser);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          supabaseId: 'supa-123',
          email: 'test@test.com',
          referralCode: 'mock-ref-code',
        }),
      });
    });

    it('should create with referrer', async () => {
      const referrer = createMockUser({ id: 'referrer-1' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(referrer);
      (prisma.user.create as jest.Mock).mockResolvedValue(createMockUser());

      await service.createFromEmail(emailUser, 'REF123');

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          referredById: 'referrer-1',
        }),
      });
    });
  });

  describe('findOrCreateFromEmail', () => {
    const emailUser: EmailUserData = {
      supabaseId: 'supa-123',
      email: 'test@test.com',
      emailVerified: true,
    };

    it('should return existing user by supabaseId', async () => {
      const user = createMockUser({
        supabaseId: 'supa-123',
        emailVerifiedAt: new Date(),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findOrCreateFromEmail(emailUser);

      expect(result.isNewUser).toBe(false);
      expect(result.user).toEqual(user);
    });

    it('should update emailVerifiedAt if not yet verified', async () => {
      const user = createMockUser({
        supabaseId: 'supa-123',
        emailVerifiedAt: null,
      });
      const updatedUser = createMockUser({
        supabaseId: 'supa-123',
        emailVerifiedAt: new Date(),
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);
      (prisma.user.update as jest.Mock).mockResolvedValue(updatedUser);

      const result = await service.findOrCreateFromEmail(emailUser);

      expect(result.isNewUser).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { emailVerifiedAt: expect.any(Date) },
      });
    });

    it('should link supabaseId if email exists', async () => {
      const userByEmail = createMockUser({
        email: 'test@test.com',
        supabaseId: null,
      });
      // First call: findBySupabaseId returns null
      // Second call: findByEmail returns the user
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // findBySupabaseId
        .mockResolvedValueOnce(userByEmail); // findByEmail
      (prisma.user.update as jest.Mock).mockResolvedValue(
        createMockUser({ supabaseId: 'supa-123' }),
      );

      const result = await service.findOrCreateFromEmail(emailUser);

      expect(result.isNewUser).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: userByEmail.id },
        data: expect.objectContaining({
          supabaseId: 'supa-123',
        }),
      });
    });

    it('should create new user if not found anywhere', async () => {
      const newUser = createMockUser({
        email: 'test@test.com',
        supabaseId: 'supa-123',
      });
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // findBySupabaseId
        .mockResolvedValueOnce(null); // findByEmail
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await service.findOrCreateFromEmail(emailUser);

      expect(result.isNewUser).toBe(true);
      expect(prisma.user.create).toHaveBeenCalled();
    });
  });

  // ============ Account Linking ============

  describe('linkTelegramToUser', () => {
    const telegramUser: TelegramUserData = {
      id: 99999999,
      username: 'newuser',
      first_name: 'New',
      last_name: 'User',
    };

    it('should link telegram to user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null); // no existing tg user
      (prisma.user.update as jest.Mock).mockResolvedValue(
        createMockUser({ telegramId: '99999999' }),
      );

      const result = await service.linkTelegramToUser(mockUserId, telegramUser);

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          telegramId: '99999999',
          username: 'newuser',
          firstName: 'New',
          lastName: 'User',
          avatarUrl: undefined,
        },
      });
      expect(result.telegramId).toBe('99999999');
    });

    it('should throw if telegram already linked to another user', async () => {
      const otherUser = createMockUser({ id: 'other-user' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(otherUser);

      await expect(
        service.linkTelegramToUser(mockUserId, telegramUser),
      ).rejects.toThrow(
        'This Telegram account is already linked to another user',
      );
    });

    it('should allow re-linking same telegram to same user', async () => {
      const sameUser = createMockUser({ id: mockUserId });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(sameUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(sameUser);

      const result = await service.linkTelegramToUser(mockUserId, telegramUser);

      expect(result).toEqual(sameUser);
    });
  });

  describe('linkEmailToUser', () => {
    it('should link email to user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.update as jest.Mock).mockResolvedValue(
        createMockUser({ email: 'new@test.com' }),
      );

      const result = await service.linkEmailToUser(
        mockUserId,
        'new@test.com',
        'supa-456',
      );

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: {
          email: 'new@test.com',
          supabaseId: 'supa-456',
          emailVerifiedAt: expect.any(Date),
        },
      });
      expect(result.email).toBe('new@test.com');
    });

    it('should throw if email already linked to another user', async () => {
      const otherUser = createMockUser({
        id: 'other-user',
        email: 'taken@test.com',
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(otherUser);

      await expect(
        service.linkEmailToUser(mockUserId, 'taken@test.com', 'supa-456'),
      ).rejects.toThrow('This email is already linked to another user');
    });
  });

  // ============ Web3 Auth ============

  describe('findByWeb3Address', () => {
    it('should return user if found', async () => {
      const user = createMockUser({ web3Address: 'So1111...' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findByWeb3Address('So1111...');

      expect(result).toEqual(user);
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { web3Address: 'So1111...' },
      });
    });
  });

  describe('findOrCreateFromWeb3', () => {
    it('should return existing user', async () => {
      const user = createMockUser({ web3Address: 'So1111...' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(user);

      const result = await service.findOrCreateFromWeb3('So1111...');

      expect(result.isNewUser).toBe(false);
      expect(result.user).toEqual(user);
    });

    it('should create new user if not found', async () => {
      const newUser = createMockUser({ web3Address: 'So1111...' });
      (prisma.user.findUnique as jest.Mock)
        .mockResolvedValueOnce(null) // findByWeb3Address
        .mockResolvedValueOnce(null); // referrer lookup (if referrerCode)
      (prisma.user.create as jest.Mock).mockResolvedValue(newUser);

      const result = await service.findOrCreateFromWeb3('So1111...');

      expect(result.isNewUser).toBe(true);
      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          web3Address: 'So1111...',
          referralCode: 'mock-ref-code',
        }),
      });
    });
  });

  describe('linkWeb3ToUser', () => {
    it('should link wallet to user', async () => {
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.user.update as jest.Mock).mockResolvedValue(
        createMockUser({ web3Address: 'So1111...' }),
      );

      const result = await service.linkWeb3ToUser(mockUserId, 'So1111...');

      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: mockUserId },
        data: { web3Address: 'So1111...' },
      });
      expect(result.web3Address).toBe('So1111...');
    });

    it('should throw if wallet already linked to another user', async () => {
      const otherUser = createMockUser({ id: 'other-user' });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(otherUser);

      await expect(
        service.linkWeb3ToUser(mockUserId, 'So1111...'),
      ).rejects.toThrow('This wallet is already linked to another user');
    });

    it('should allow re-linking same wallet to same user', async () => {
      const sameUser = createMockUser({
        id: mockUserId,
        web3Address: 'So1111...',
      });
      (prisma.user.findUnique as jest.Mock).mockResolvedValue(sameUser);
      (prisma.user.update as jest.Mock).mockResolvedValue(sameUser);

      const result = await service.linkWeb3ToUser(mockUserId, 'So1111...');

      expect(result).toEqual(sameUser);
    });
  });
});
