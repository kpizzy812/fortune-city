import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import * as crypto from 'crypto';
import { AdminLoginDto, AdminAuthResponseDto } from '../dto/admin-auth.dto';

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
  async login(dto: AdminLoginDto): Promise<AdminAuthResponseDto> {
    const { username, password } = dto;

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

    return {
      accessToken,
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
}
