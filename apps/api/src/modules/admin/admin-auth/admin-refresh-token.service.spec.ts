import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { AdminRefreshTokenService } from './admin-refresh-token.service';
import { PrismaService } from '../../prisma/prisma.service';

describe('AdminRefreshTokenService', () => {
  let service: AdminRefreshTokenService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminRefreshTokenService,
        {
          provide: PrismaService,
          useValue: {
            adminRefreshToken: {
              create: jest.fn(),
              findUnique: jest.fn(),
              delete: jest.fn(),
              deleteMany: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<AdminRefreshTokenService>(AdminRefreshTokenService);
    prisma = module.get(PrismaService);

    jest.clearAllMocks();
  });

  describe('createRefreshToken', () => {
    it('should create and return 128-char hex token', async () => {
      (prisma.adminRefreshToken.create as jest.Mock).mockResolvedValue({});

      const token = await service.createRefreshToken('admin');

      expect(typeof token).toBe('string');
      expect(token.length).toBe(128);
      expect(prisma.adminRefreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          username: 'admin',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should save metadata', async () => {
      (prisma.adminRefreshToken.create as jest.Mock).mockResolvedValue({});

      await service.createRefreshToken('admin', {
        ipAddress: '1.2.3.4',
        userAgent: 'Chrome',
      });

      expect(prisma.adminRefreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          ipAddress: '1.2.3.4',
          userAgent: 'Chrome',
        }),
      });
    });
  });

  describe('validateAndRotateToken', () => {
    it('should throw if token not found', async () => {
      (prisma.adminRefreshToken.findUnique as jest.Mock).mockResolvedValue(
        null,
      );

      await expect(service.validateAndRotateToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw and delete if token expired', async () => {
      const expired = new Date();
      expired.setDate(expired.getDate() - 1);

      (prisma.adminRefreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        username: 'admin',
        expiresAt: expired,
      });
      (prisma.adminRefreshToken.delete as jest.Mock).mockResolvedValue({});

      await expect(
        service.validateAndRotateToken('expired-token'),
      ).rejects.toThrow('Refresh token expired');

      expect(prisma.adminRefreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
    });

    it('should rotate valid token', async () => {
      const future = new Date();
      future.setDate(future.getDate() + 15);

      (prisma.adminRefreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: 'rt-1',
        username: 'admin',
        expiresAt: future,
      });
      (prisma.adminRefreshToken.delete as jest.Mock).mockResolvedValue({});
      (prisma.adminRefreshToken.create as jest.Mock).mockResolvedValue({});

      const result = await service.validateAndRotateToken('valid-token');

      expect(result.username).toBe('admin');
      expect(result.newToken.length).toBe(128);
      expect(prisma.adminRefreshToken.delete).toHaveBeenCalledWith({
        where: { id: 'rt-1' },
      });
    });
  });

  describe('revokeAllAdminTokens', () => {
    it('should delete all tokens for admin', async () => {
      (prisma.adminRefreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 2,
      });

      await service.revokeAllAdminTokens('admin');

      expect(prisma.adminRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: { username: 'admin' },
      });
    });
  });

  describe('revokeToken', () => {
    it('should delete by hashed token', async () => {
      (prisma.adminRefreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 1,
      });

      await service.revokeToken('some-token');

      expect(prisma.adminRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: { token: expect.any(String) },
      });
    });
  });

  describe('cleanupExpiredTokens', () => {
    it('should delete expired tokens', async () => {
      (prisma.adminRefreshToken.deleteMany as jest.Mock).mockResolvedValue({
        count: 3,
      });

      await service.cleanupExpiredTokens();

      expect(prisma.adminRefreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          expiresAt: { lt: expect.any(Date) },
        },
      });
    });
  });
});
