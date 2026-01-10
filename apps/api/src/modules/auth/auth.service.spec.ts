import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import * as crypto from 'crypto';

// Mock @tma.js/init-data-node
jest.mock('@tma.js/init-data-node', () => ({
  validate: jest.fn(),
  parse: jest.fn(),
}));

import { validate, parse } from '@tma.js/init-data-node';

describe('AuthService', () => {
  let service: AuthService;
  let usersService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;

  const mockBotToken = '123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
  const mockJwtSecret = 'test-jwt-secret';

  const mockUser = {
    id: 'user-123',
    telegramId: '12345678',
    username: 'testuser',
    firstName: 'Test',
    lastName: 'User',
    fortuneBalance: { toString: () => '100.00' },
    usdtBalance: { toString: () => '50.00' },
    maxTierReached: 1,
    currentTaxRate: { toString: () => '0.50' },
    referralCode: 'abc123',
    referredById: null,
    freeSpinsRemaining: 0,
    lastSpinAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn((key: string) => {
              if (key === 'TELEGRAM_BOT_TOKEN') return mockBotToken;
              if (key === 'JWT_SECRET') return mockJwtSecret;
              throw new Error(`Unknown key: ${key}`);
            }),
            get: jest.fn((key: string, defaultValue: string) => {
              if (key === 'JWT_EXPIRES_IN') return '7d';
              return defaultValue;
            }),
          },
        },
        {
          provide: JwtService,
          useValue: {
            sign: jest.fn().mockReturnValue('mock-jwt-token'),
            verify: jest.fn().mockReturnValue({
              sub: 'user-123',
              telegramId: '12345678',
              username: 'testuser',
            }),
          },
        },
        {
          provide: UsersService,
          useValue: {
            findOrCreateFromTelegram: jest.fn().mockResolvedValue(mockUser),
            findById: jest.fn().mockResolvedValue(mockUser),
            findByTelegramId: jest.fn().mockResolvedValue(mockUser),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    usersService = module.get(UsersService);
    jwtService = module.get(JwtService);

    jest.clearAllMocks();
  });

  describe('authWithInitData', () => {
    const mockInitData = 'query_id=AAH...&user=%7B%22id%22%3A12345678%7D';

    beforeEach(() => {
      (validate as jest.Mock).mockImplementation(() => {});
      (parse as jest.Mock).mockReturnValue({
        user: {
          id: 12345678,
          username: 'testuser',
          firstName: 'Test',
          lastName: 'User',
        },
      });
    });

    it('should authenticate user with valid initData', async () => {
      const result = await service.authWithInitData(mockInitData);

      expect(validate).toHaveBeenCalledWith(mockInitData, mockBotToken, {
        expiresIn: 3600,
      });
      expect(parse).toHaveBeenCalledWith(mockInitData);
      expect(usersService.findOrCreateFromTelegram).toHaveBeenCalledWith({
        id: 12345678,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
      });
      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result).toHaveProperty('user');
      expect(result.user.telegramId).toBe('12345678');
    });

    it('should throw UnauthorizedException for invalid initData', async () => {
      (validate as jest.Mock).mockImplementation(() => {
        throw new Error('Invalid signature');
      });

      await expect(service.authWithInitData(mockInitData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException when user data is missing', async () => {
      (parse as jest.Mock).mockReturnValue({ user: null });

      await expect(service.authWithInitData(mockInitData)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('authWithLoginWidget', () => {
    const createValidLoginData = () => {
      const authDate = Math.floor(Date.now() / 1000);
      const dataCheckString = `auth_date=${authDate}\nfirst_name=Test\nid=12345678\nlast_name=User\nusername=testuser`;

      const secretKey = crypto
        .createHash('sha256')
        .update(mockBotToken)
        .digest();

      const hash = crypto
        .createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      return {
        id: 12345678,
        first_name: 'Test',
        last_name: 'User',
        username: 'testuser',
        auth_date: authDate,
        hash,
      };
    };

    it('should authenticate user with valid login widget data', async () => {
      const loginData = createValidLoginData();
      const result = await service.authWithLoginWidget(loginData);

      expect(usersService.findOrCreateFromTelegram).toHaveBeenCalledWith({
        id: 12345678,
        username: 'testuser',
        first_name: 'Test',
        last_name: 'User',
      });
      expect(result).toHaveProperty('accessToken', 'mock-jwt-token');
      expect(result.user.telegramId).toBe('12345678');
    });

    it('should throw UnauthorizedException for expired auth data', async () => {
      const loginData = createValidLoginData();
      loginData.auth_date = Math.floor(Date.now() / 1000) - 90000; // More than 1 day ago

      await expect(service.authWithLoginWidget(loginData)).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException for invalid hash', async () => {
      const loginData = createValidLoginData();
      loginData.hash = 'invalid-hash';

      await expect(service.authWithLoginWidget(loginData)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('validateJwt', () => {
    it('should return payload for valid token', () => {
      const result = service.validateJwt('valid-token');

      expect(jwtService.verify).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual({
        sub: 'user-123',
        telegramId: '12345678',
        username: 'testuser',
      });
    });

    it('should throw UnauthorizedException for invalid token', () => {
      jwtService.verify.mockImplementation(() => {
        throw new Error('Invalid token');
      });

      expect(() => service.validateJwt('invalid-token')).toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('getCurrentUser', () => {
    it('should return user for valid payload', async () => {
      const payload = {
        sub: 'user-123',
        telegramId: '12345678',
        username: 'testuser',
      };

      const result = await service.getCurrentUser(payload);

      expect(usersService.findById).toHaveBeenCalledWith('user-123');
      expect(result.id).toBe('user-123');
    });

    it('should throw UnauthorizedException when user not found', async () => {
      usersService.findById.mockResolvedValue(null);

      const payload = {
        sub: 'non-existent',
        telegramId: '12345678',
      };

      await expect(service.getCurrentUser(payload)).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
