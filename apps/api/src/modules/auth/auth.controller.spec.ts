jest.mock('nanoid', () => ({ nanoid: jest.fn(() => 'mock-id') }));
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mock-jwks'),
  jwtVerify: jest.fn(),
}));

import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { SupabaseAuthService } from './supabase-auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: jest.Mocked<AuthService>;
  let configService: jest.Mocked<ConfigService>;

  const mockAuthResponse = {
    accessToken: 'jwt-token',
    refreshToken: 'refresh-token',
    user: {
      id: 'user-1',
      telegramId: '123',
      email: null,
      web3Address: null,
      username: 'testuser',
      firstName: 'Test',
      lastName: 'User',
      avatarUrl: null,
      fortuneBalance: '100',
      referralBalance: '0',
      maxTierReached: 1,
      maxTierUnlocked: 1,
      currentTaxRate: '0.5',
      taxDiscount: '0',
      referralCode: 'ABC123',
      fame: 0,
      totalFameEarned: 0,
      loginStreak: 1,
      lastLoginDate: null,
    },
  };

  const mockReq = {
    ip: '127.0.0.1',
    get: jest.fn().mockReturnValue('test-agent'),
    user: { sub: 'user-1' },
  } as any;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: {
            authWithInitData: jest.fn().mockResolvedValue(mockAuthResponse),
            authWithLoginWidget: jest.fn().mockResolvedValue(mockAuthResponse),
            getCurrentUser: jest.fn(),
            authWithSupabaseToken: jest
              .fn()
              .mockResolvedValue(mockAuthResponse),
            linkTelegram: jest.fn().mockResolvedValue(mockAuthResponse),
            linkEmail: jest.fn().mockResolvedValue(mockAuthResponse),
            authWithWeb3Token: jest.fn().mockResolvedValue(mockAuthResponse),
            linkWeb3: jest.fn().mockResolvedValue(mockAuthResponse),
            refreshAccessToken: jest.fn().mockResolvedValue(mockAuthResponse),
            logout: jest.fn().mockResolvedValue(undefined),
            exchangeTelegramBotToken: jest
              .fn()
              .mockResolvedValue(mockAuthResponse),
            devLogin: jest.fn().mockResolvedValue(mockAuthResponse),
          },
        },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn().mockReturnValue('development'),
          },
        },
        {
          provide: SupabaseAuthService,
          useValue: {
            verifyToken: jest.fn(),
          },
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get(AuthService);
    configService = module.get(ConfigService);

    jest.clearAllMocks();
  });

  describe('authWithInitData', () => {
    it('should delegate to authService.authWithInitData', async () => {
      (authService.authWithInitData as jest.Mock).mockResolvedValue(
        mockAuthResponse,
      );

      const result = await controller.authWithInitData(
        { initData: 'test-init-data', referralCode: 'REF1', rememberMe: true },
        mockReq,
      );

      expect(result.accessToken).toBe('jwt-token');
      expect(authService.authWithInitData).toHaveBeenCalledWith(
        'test-init-data',
        'REF1',
        true,
        { ipAddress: '127.0.0.1', userAgent: 'test-agent' },
      );
    });
  });

  describe('authWithLoginWidget', () => {
    it('should delegate to authService.authWithLoginWidget', async () => {
      (authService.authWithLoginWidget as jest.Mock).mockResolvedValue(
        mockAuthResponse,
      );

      const dto = {
        id: 123,
        hash: 'abc',
        referralCode: 'REF1',
        rememberMe: false,
      } as any;

      const result = await controller.authWithLoginWidget(dto, mockReq);

      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('getMe', () => {
    it('should return current user data', async () => {
      const mockUser = {
        id: 'user-1',
        telegramId: '123',
        email: null,
        web3Address: null,
        username: 'testuser',
        firstName: 'Test',
        lastName: 'User',
        avatarUrl: null,
        fortuneBalance: { toString: () => '100' },
        referralBalance: { toString: () => '0' },
        maxTierReached: 1,
        maxTierUnlocked: 1,
        currentTaxRate: { toString: () => '0.5' },
        taxDiscount: { toString: () => '0' },
        referralCode: 'ABC123',
        fame: 0,
        totalFameEarned: 0,
        loginStreak: 1,
        lastLoginDate: null,
      };
      (authService.getCurrentUser as jest.Mock).mockResolvedValue(mockUser);

      const result = await controller.getMe(mockReq);

      expect(result.id).toBe('user-1');
      expect(result.fortuneBalance).toBe('100');
    });
  });

  describe('authWithSupabase', () => {
    it('should delegate to authService.authWithSupabaseToken', async () => {
      const result = await controller.authWithSupabase({
        accessToken: 'sb-token',
        referralCode: 'REF1',
      } as any);

      expect(authService.authWithSupabaseToken).toHaveBeenCalledWith(
        'sb-token',
        'REF1',
      );
      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('refresh', () => {
    it('should delegate to authService.refreshAccessToken', async () => {
      const result = await controller.refresh(
        { refreshToken: 'rt-1' },
        mockReq,
      );

      expect(authService.refreshAccessToken).toHaveBeenCalledWith('rt-1', {
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      });
      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('logout', () => {
    it('should call authService.logout and return success', async () => {
      const result = await controller.logout(mockReq);

      expect(result).toEqual({ success: true });
      expect(authService.logout).toHaveBeenCalledWith('user-1');
    });
  });

  describe('devLogin', () => {
    it('should call authService.devLogin in development', async () => {
      (configService.get as jest.Mock).mockReturnValue('development');

      const result = await controller.devLogin();

      expect(result.accessToken).toBe('jwt-token');
      expect(authService.devLogin).toHaveBeenCalledWith('123456789');
    });

    it('should throw ForbiddenException in production', async () => {
      (configService.get as jest.Mock).mockReturnValue('production');

      await expect(controller.devLogin()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('telegramBotLogin', () => {
    it('should exchange telegram bot token', async () => {
      const result = await controller.telegramBotLogin({
        token: 'bot-token-1',
      });

      expect(result.accessToken).toBe('jwt-token');
      expect(authService.exchangeTelegramBotToken).toHaveBeenCalledWith(
        'bot-token-1',
      );
    });
  });

  describe('linkTelegram', () => {
    it('should link telegram to current user', async () => {
      const dto = { id: 123, hash: 'abc' } as any;

      const result = await controller.linkTelegram(mockReq, dto);

      expect(authService.linkTelegram).toHaveBeenCalledWith('user-1', dto);
      expect(result.accessToken).toBe('jwt-token');
    });
  });

  describe('linkWeb3', () => {
    it('should link web3 wallet to current user', async () => {
      const result = await controller.linkWeb3(mockReq, {
        accessToken: 'web3-token',
      } as any);

      expect(authService.linkWeb3).toHaveBeenCalledWith('user-1', 'web3-token');
      expect(result.accessToken).toBe('jwt-token');
    });
  });
});
