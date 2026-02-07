import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

// Mock jose before importing service
jest.mock('jose', () => ({
  createRemoteJWKSet: jest.fn().mockReturnValue('mock-jwks'),
  jwtVerify: jest.fn(),
}));

import { SupabaseAuthService } from './supabase-auth.service';
import { jwtVerify } from 'jose';

describe('SupabaseAuthService', () => {
  let service: SupabaseAuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SupabaseAuthService,
        {
          provide: ConfigService,
          useValue: {
            getOrThrow: jest.fn().mockReturnValue('https://test.supabase.co'),
          },
        },
      ],
    }).compile();

    service = module.get<SupabaseAuthService>(SupabaseAuthService);

    jest.clearAllMocks();
  });

  describe('verifyToken', () => {
    it('should return payload on valid token', async () => {
      const mockPayload = {
        sub: 'user-uuid-123',
        email: 'test@test.com',
        aud: 'authenticated',
        role: 'authenticated',
      };
      (jwtVerify as jest.Mock).mockResolvedValue({ payload: mockPayload });

      const result = await service.verifyToken('valid-token');

      expect(result.sub).toBe('user-uuid-123');
      expect(result.email).toBe('test@test.com');
    });

    it('should throw UnauthorizedException on invalid token', async () => {
      (jwtVerify as jest.Mock).mockRejectedValue(new Error('Invalid JWT'));

      await expect(service.verifyToken('bad-token')).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });

  describe('isEmailVerified', () => {
    it('should return true for verified email', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        email_verified: true,
      } as any;

      expect(service.isEmailVerified(payload)).toBe(true);
    });

    it('should return false for unverified email', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        email_verified: false,
      } as any;

      expect(service.isEmailVerified(payload)).toBe(false);
    });

    it('should return false when email_verified is undefined', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
      } as any;

      expect(service.isEmailVerified(payload)).toBe(false);
    });
  });

  describe('getWalletAddress', () => {
    it('should extract address from custom_claims', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: {
          custom_claims: {
            address: 'SolanaWalletAddress123',
          },
        },
      } as any;

      expect(service.getWalletAddress(payload)).toBe('SolanaWalletAddress123');
    });

    it('should extract address from web3:solana:ADDRESS format', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: {
          sub: 'web3:solana:7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        },
      } as any;

      expect(service.getWalletAddress(payload)).toBe(
        '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
      );
    });

    it('should return null if no wallet address found', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
        user_metadata: {},
      } as any;

      expect(service.getWalletAddress(payload)).toBeNull();
    });

    it('should return null if user_metadata is missing', () => {
      const payload = {
        sub: 'user-1',
        aud: 'authenticated',
        role: 'authenticated',
      } as any;

      expect(service.getWalletAddress(payload)).toBeNull();
    });
  });
});
