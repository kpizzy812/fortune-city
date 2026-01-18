import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet, jwtVerify, JWTPayload } from 'jose';

export interface SupabaseJwtPayload extends JWTPayload {
  sub: string; // Supabase user UUID
  email?: string;
  email_verified?: boolean;
  phone?: string;
  aud: string;
  role: string;
  app_metadata?: {
    provider?: string;
    providers?: string[];
    [key: string]: unknown;
  };
  user_metadata?: {
    // Web3 wallet address (Solana/Ethereum public key)
    wallet_address?: string;
    address?: string;
    [key: string]: unknown;
  };
  // AMR contains authentication method details including wallet address
  amr?: Array<{
    method: string;
    timestamp: number;
    provider?: string;
  }>;
}

@Injectable()
export class SupabaseAuthService {
  private readonly logger = new Logger(SupabaseAuthService.name);
  private readonly jwks: ReturnType<typeof createRemoteJWKSet>;
  private readonly supabaseUrl: string;

  constructor(private readonly configService: ConfigService) {
    this.supabaseUrl = this.configService.getOrThrow<string>('SUPABASE_URL');

    // Create JWKS endpoint для валидации JWT
    const jwksUrl = `${this.supabaseUrl}/auth/v1/.well-known/jwks.json`;
    this.jwks = createRemoteJWKSet(new URL(jwksUrl));

    this.logger.log(`Supabase Auth initialized with JWKS: ${jwksUrl}`);
  }

  /**
   * Валидирует Supabase JWT токен через JWKS
   * @param token - Access token от Supabase Auth
   * @returns Payload токена с информацией о пользователе
   */
  async verifyToken(token: string): Promise<SupabaseJwtPayload> {
    try {
      const { payload } = await jwtVerify(token, this.jwks, {
        issuer: `${this.supabaseUrl}/auth/v1`,
        audience: 'authenticated',
      });

      this.logger.debug(`Supabase token verified for user: ${payload.sub}`);

      return payload as SupabaseJwtPayload;
    } catch (error) {
      this.logger.error('Supabase token verification failed:', error);
      throw new UnauthorizedException('Invalid Supabase token');
    }
  }

  /**
   * Проверяет, подтверждён ли email пользователя
   * @param payload - Payload от Supabase JWT
   * @returns true если email подтверждён
   */
  isEmailVerified(payload: SupabaseJwtPayload): boolean {
    return payload.email_verified === true;
  }

  /**
   * Извлекает адрес кошелька из Supabase JWT payload
   * Для Web3 auth адрес находится в user_metadata.custom_claims.address
   * @param payload - Payload от Supabase JWT
   * @returns Wallet address или null
   */
  getWalletAddress(payload: SupabaseJwtPayload): string | null {
    const userMetadata = payload.user_metadata;

    if (userMetadata) {
      // Supabase Web3 stores address in custom_claims.address
      const customClaims = userMetadata.custom_claims as
        | { address?: string }
        | undefined;
      if (customClaims?.address) {
        return customClaims.address;
      }

      // Fallback: extract from sub field (format: "web3:solana:ADDRESS")
      if (
        typeof userMetadata.sub === 'string' &&
        userMetadata.sub.startsWith('web3:')
      ) {
        const parts = userMetadata.sub.split(':');
        if (parts.length >= 3) {
          return parts[2]; // ADDRESS part
        }
      }
    }

    this.logger.warn(
      `Wallet address not found in JWT payload. user_metadata: ${JSON.stringify(userMetadata)}`,
    );
    return null;
  }
}
