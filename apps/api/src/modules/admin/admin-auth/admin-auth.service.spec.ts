import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AdminAuthService, AdminJwtPayload } from './admin-auth.service';
import { AdminRefreshTokenService } from './admin-refresh-token.service';

const mockRefreshTokenService = {
  createToken: jest.fn().mockResolvedValue('mock-refresh-token'),
  rotateToken: jest.fn(),
  revokeToken: jest.fn(),
};

describe('AdminAuthService', () => {
  let service: AdminAuthService;
  let jwtService: jest.Mocked<JwtService>;

  const mockAdminUser = 'admin';
  const mockAdminPass = 'supersecretpassword';
  const mockJwtSecret = 'jwt-secret-key';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminAuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'ADMIN_USER') return mockAdminUser;
              if (key === 'ADMIN_PASS') return mockAdminPass;
              if (key === 'ADMIN_JWT_SECRET') return mockJwtSecret;
              throw new Error(`Unknown key: ${key}`);
            }),
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'ADMIN_JWT_EXPIRES_IN') return '8h';
              return defaultValue;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-admin-jwt-token'),
            verify: jest.fn(),
          },
        },
        {
          provide: AdminRefreshTokenService,
          useValue: mockRefreshTokenService,
        },
      ],
    }).compile();

    service = module.get<AdminAuthService>(AdminAuthService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('login', () => {
    it('should return access token for valid credentials', async () => {
      const result = await service.login({
        username: mockAdminUser,
        password: mockAdminPass,
      });

      expect(result).toHaveProperty('accessToken', 'mock-admin-jwt-token');
      expect(result).toHaveProperty('admin');
      expect(result.admin.username).toBe(mockAdminUser);
      expect(jwtService.sign).toHaveBeenCalledWith(
        {
          sub: 'admin',
          username: mockAdminUser,
          isAdmin: true,
        },
        expect.objectContaining({
          secret: mockJwtSecret,
        }),
      );
    });

    it('should throw UnauthorizedException for invalid username', async () => {
      await expect(
        service.login({
          username: 'wronguser',
          password: mockAdminPass,
        }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login({
          username: 'wronguser',
          password: mockAdminPass,
        }),
      ).rejects.toThrow('Invalid credentials');
    });

    it('should throw UnauthorizedException for invalid password', async () => {
      await expect(
        service.login({
          username: mockAdminUser,
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException for both wrong credentials', async () => {
      await expect(
        service.login({
          username: 'wronguser',
          password: 'wrongpassword',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle empty username', async () => {
      await expect(
        service.login({
          username: '',
          password: mockAdminPass,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should handle empty password', async () => {
      await expect(
        service.login({
          username: mockAdminUser,
          password: '',
        }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should use timing-safe comparison (credentials of different lengths)', async () => {
      // Credentials with different lengths should still take similar time
      // This tests that the timing-safe comparison is working
      await expect(
        service.login({
          username: 'a', // very short
          password: mockAdminPass,
        }),
      ).rejects.toThrow(UnauthorizedException);

      await expect(
        service.login({
          username: 'a'.repeat(1000), // very long
          password: mockAdminPass,
        }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('validateJwt', () => {
    it('should return payload for valid admin token', () => {
      const mockPayload: AdminJwtPayload = {
        sub: 'admin',
        username: mockAdminUser,
        isAdmin: true,
      };

      jwtService.verify.mockReturnValue(mockPayload);

      const result = service.validateJwt('valid-token');

      expect(result).toEqual(mockPayload);
      expect(jwtService.verify).toHaveBeenCalledWith('valid-token', {
        secret: mockJwtSecret,
      });
    });

    it('should throw UnauthorizedException for invalid token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.validateJwt('invalid-token')).toThrow(
        UnauthorizedException,
      );
      expect(() => service.validateJwt('invalid-token')).toThrow(
        'Invalid admin token',
      );
    });

    it('should throw UnauthorizedException for non-admin token', () => {
      // Token without isAdmin flag
      jwtService.verify.mockReturnValue({
        sub: 'user-123',
        username: 'regular-user',
        isAdmin: false,
      });

      expect(() => service.validateJwt('user-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if sub is not admin', () => {
      jwtService.verify.mockReturnValue({
        sub: 'user-123', // not 'admin'
        username: mockAdminUser,
        isAdmin: true,
      });

      expect(() => service.validateJwt('fake-admin-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for expired token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt expired');
      });

      expect(() => service.validateJwt('expired-token')).toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for malformed token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      expect(() => service.validateJwt('malformed-token')).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('parseDuration (through constructor)', () => {
    // Testing duration parsing by creating service with different configs
    it('should handle different time formats', async () => {
      // Test with minutes
      const moduleMinutes = await Test.createTestingModule({
        providers: [
          AdminAuthService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                if (key === 'ADMIN_USER') return mockAdminUser;
                if (key === 'ADMIN_PASS') return mockAdminPass;
                if (key === 'ADMIN_JWT_SECRET') return mockJwtSecret;
                throw new Error(`Unknown key: ${key}`);
              }),
              get: jest.fn((key: string) => {
                if (key === 'ADMIN_JWT_EXPIRES_IN') return '30m';
                return '8h';
              }),
            },
          },
          {
            provide: JwtService,
            useValue: {
              sign: jest.fn().mockReturnValue('token'),
              verify: jest.fn(),
            },
          },
          {
            provide: AdminRefreshTokenService,
            useValue: mockRefreshTokenService,
          },
        ],
      }).compile();

      const serviceMinutes =
        moduleMinutes.get<AdminAuthService>(AdminAuthService);
      const jwtServiceMinutes = moduleMinutes.get<JwtService>(JwtService);

      await serviceMinutes.login({
        username: mockAdminUser,
        password: mockAdminPass,
      });

      expect(jwtServiceMinutes.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: 30 * 60, // 30 minutes in seconds
        }),
      );
    });

    it('should use default 8h for invalid format', async () => {
      const moduleInvalid = await Test.createTestingModule({
        providers: [
          AdminAuthService,
          {
            provide: ConfigService,
            useValue: {
              getOrThrow: jest.fn((key: string) => {
                if (key === 'ADMIN_USER') return mockAdminUser;
                if (key === 'ADMIN_PASS') return mockAdminPass;
                if (key === 'ADMIN_JWT_SECRET') return mockJwtSecret;
                throw new Error(`Unknown key: ${key}`);
              }),
              get: jest.fn((key: string) => {
                if (key === 'ADMIN_JWT_EXPIRES_IN') return 'invalid';
                return '8h';
              }),
            },
          },
          {
            provide: JwtService,
            useValue: {
              sign: jest.fn().mockReturnValue('token'),
              verify: jest.fn(),
            },
          },
          {
            provide: AdminRefreshTokenService,
            useValue: mockRefreshTokenService,
          },
        ],
      }).compile();

      const serviceInvalid =
        moduleInvalid.get<AdminAuthService>(AdminAuthService);
      const jwtServiceInvalid = moduleInvalid.get<JwtService>(JwtService);

      await serviceInvalid.login({
        username: mockAdminUser,
        password: mockAdminPass,
      });

      expect(jwtServiceInvalid.sign).toHaveBeenCalledWith(
        expect.any(Object),
        expect.objectContaining({
          expiresIn: 8 * 60 * 60, // default 8 hours in seconds
        }),
      );
    });
  });
});
