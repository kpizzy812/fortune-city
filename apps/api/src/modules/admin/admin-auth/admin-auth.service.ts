import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AdminLoginDto, AdminAuthResponseDto } from '../dto/admin-auth.dto';
import { AdminRefreshTokenService, RefreshTokenMetadata } from './admin-refresh-token.service';

export interface AdminJwtPayload {
  sub: string; // 'admin'
  username: string;
  isAdmin: true;
}

@Injectable()
export class AdminAuthService {
  private readonly logger = new Logger(AdminAuthService.name);
  private readonly adminUser: string;
  private readonly adminPass: string;
  private readonly jwtSecret: string;
  private readonly jwtExpiresInMs: number;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly refreshTokenService: AdminRefreshTokenService,
  ) {
    this.adminUser = this.configService.getOrThrow<string>('ADMIN_USER');
    this.adminPass = this.configService.getOrThrow<string>('ADMIN_PASS');
    this.jwtSecret = this.configService.getOrThrow<string>('ADMIN_JWT_SECRET');

    // Parse duration string to milliseconds (default 8h)
    const expiresIn = this.configService.get<string>(
      'ADMIN_JWT_EXPIRES_IN',
      '8h',
    );
    this.jwtExpiresInMs = this.parseDuration(expiresIn);
  }

  /**
   * Parse duration string (e.g., '8h', '1d', '30m') to seconds
   */
  private parseDuration(duration: string): number {
    const match = duration.match(/^(\d+)([smhd])$/);
    if (!match) return 8 * 60 * 60; // default 8 hours in seconds

    const value = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
      case 's':
        return value;
      case 'm':
        return value * 60;
      case 'h':
        return value * 60 * 60;
      case 'd':
        return value * 24 * 60 * 60;
      default:
        return 8 * 60 * 60;
    }
  }

  /**
   * Аутентификация админа по логину/паролю
   */
  async login(
    dto: AdminLoginDto,
    metadata?: RefreshTokenMetadata,
  ): Promise<AdminAuthResponseDto> {
    const { username, password, rememberMe } = dto;

    // Проверка credentials
    if (!this.verifyCredentials(username, password)) {
      this.logger.warn(`Failed admin login attempt for username: ${username}`);
      throw new UnauthorizedException('Invalid credentials');
    }

    this.logger.log(`Admin logged in: ${username}`);

    // Создать JWT
    const payload = {
      sub: 'admin',
      username: this.adminUser,
      isAdmin: true,
    };

    const signOptions: JwtSignOptions = {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresInMs,
    };

    const accessToken = this.jwtService.sign(payload, signOptions);

    // Создать refresh token если rememberMe = true
    let refreshToken: string | undefined;
    if (rememberMe) {
      refreshToken = await this.refreshTokenService.createRefreshToken(
        this.adminUser,
        metadata,
      );
    }

    return {
      accessToken,
      refreshToken,
      admin: {
        username: this.adminUser,
      },
    };
  }

  /**
   * Проверка логина/пароля
   */
  private verifyCredentials(username: string, password: string): boolean {
    // Timing-safe comparison для предотвращения timing attacks
    const usernameMatch = this.timingSafeEqual(username, this.adminUser);
    const passwordMatch = this.timingSafeEqual(password, this.adminPass);

    return usernameMatch && passwordMatch;
  }

  /**
   * Timing-safe сравнение строк
   */
  private timingSafeEqual(a: string, b: string): boolean {
    try {
      const bufA = Buffer.from(a);
      const bufB = Buffer.from(b);

      if (bufA.length !== bufB.length) {
        // Делаем сравнение с dummy для сохранения времени
        crypto.timingSafeEqual(bufA, Buffer.alloc(bufA.length));
        return false;
      }

      return crypto.timingSafeEqual(bufA, bufB);
    } catch {
      return false;
    }
  }

  /**
   * Валидация JWT токена админа
   */
  validateJwt(token: string): AdminJwtPayload {
    try {
      const payload = this.jwtService.verify<AdminJwtPayload>(token, {
        secret: this.jwtSecret,
      });

      // Дополнительная проверка что это админ-токен
      if (!payload.isAdmin || payload.sub !== 'admin') {
        throw new UnauthorizedException('Invalid admin token');
      }

      return payload;
    } catch {
      throw new UnauthorizedException('Invalid admin token');
    }
  }

  /**
   * Обновление access token через refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    metadata?: RefreshTokenMetadata,
  ): Promise<AdminAuthResponseDto> {
    // Валидируем и ротируем refresh token
    const { username, newToken } =
      await this.refreshTokenService.validateAndRotateToken(
        refreshToken,
        metadata,
      );

    // Создаём новый access token
    const payload = {
      sub: 'admin',
      username,
      isAdmin: true as const,
    };

    const signOptions: JwtSignOptions = {
      secret: this.jwtSecret,
      expiresIn: this.jwtExpiresInMs,
    };

    const accessToken = this.jwtService.sign(payload, signOptions);

    return {
      accessToken,
      refreshToken: newToken,
      admin: {
        username,
      },
    };
  }

  /**
   * Выход из системы (отзыв всех refresh токенов админа)
   */
  async logout(username: string): Promise<void> {
    await this.refreshTokenService.revokeAllAdminTokens(username);
    this.logger.log(`Admin ${username} logged out`);
  }
}
