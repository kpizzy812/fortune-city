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
  app_metadata?: Record<string, unknown>;
  user_metadata?: Record<string, unknown>;
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
}
