import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { RefreshTokenService } from './refresh-token.service';
import { PrismaService } from '../prisma/prisma.service';

describe('RefreshTokenService', () => {
  let service: RefreshTokenService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RefreshTokenService,
        {
          provide: PrismaService,
          useValue: {
            refreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<RefreshTokenService>(RefreshTokenService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    it('should create and return a token', async () => {
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'rt-1',
      });

      const token = await service.createRefreshToken('user-1');

      expect(typeof token).toBe('string');
      expect(token.length).toBe(128); // 64 bytes = 128 hex chars
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: expect.any(String), // hashed
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should save metadata if provided', async () => {
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({});

      await service.createRefreshToken('user-1', {
        ipAddress: '1.2.3.4',
        userAgent: 'TestBrowser',
      });

      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '1.2.3.4',
          userAgent: 'TestBrowser',
        }),
      });
    });
  });

  describe('validateAndRotateToken', () => {
    it('should throw if token not found', async () => {
      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(
        service.validateAndRotateToken('invalid-token'),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw if token expired', async () => {
      const expired = new Date();
      expired.setDate(expired.getDate() - 1);

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        expiresAt: expired,
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});

      await expect(
        service.validateAndRotateToken('some-token'),
      ).rejects.toThrow('Refresh token expired');

      // Should delete expired token
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
    });

    it('should rotate valid token', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 15);

      (prisma.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        userId: 'user-1',
        expiresAt: future,
      });
      (prisma.refreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.refreshToken.create as jest.Mock).mockResolvedValue({
        id: 'rt-2',
      });

      const result = await service.validateAndRotateToken('valid-token');

      expect(result.userId).toBe('user-1');
      expect(typeof result.newToken).toBe('string');
      expect(result.newToken.length).toBe(128);

      // Should delete old token
      expect(prisma.refreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
      // Should create new token
      expect(prisma.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe('revokeAllUserTokens', () => {
    it('should delete all user tokens', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.revokeAllUserTokens('user-1');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
      });
    });
  });

  describe('revokeToken', () => {
    it('should delete specific token by hash', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.revokeToken('some-token');

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: expect.any(String) },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      (prisma.refreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 5,
      });

      await service.cleanupExpiredTokens();

      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
