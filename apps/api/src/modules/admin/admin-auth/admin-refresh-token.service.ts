import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import * as crypto from 'crypto';

const REFRESH_TOKEN_LENGTH = 64; // 64 bytes = 128 hex characters
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

export interface RefreshTokenMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class AdminRefreshTokenService {
  private readonly logger = new Logger(AdminRefreshTokenService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Генерирует криптографически стойкий случайный refresh token
   */
  private generateToken(): string {
    return crypto.randomBytes(REFRESH_TOKEN_LENGTH).toString('hex');
  }

  /**
   * Хеширует refresh token для безопасного хранения в БД
   */
  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Создаёт refresh token для админа
   * @returns Незахешированный токен (его нужно вернуть клиенту)
   */
  async createRefreshToken(
    username: string,
    metadata?: RefreshTokenMetadata,
  ): Promise<string> {
    // Генерируем токен
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);

    // Вычисляем дату экспирации
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Сохраняем в БД
    await this.prisma.adminRefreshToken.create({
      data: {
        username,
        token: hashedToken,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    this.logger.log(`Created refresh token for admin ${username}`);
    return token; // Возвращаем незахешированный токен
  }

  /**
   * Валидирует refresh token и возвращает username
   * После валидации выполняет ротацию (удаляет старый, создаёт новый)
   * @returns {username, newToken} - Username админа и новый refresh token
   */
  async validateAndRotateToken(
    token: string,
    metadata?: RefreshTokenMetadata,
  ): Promise<{ username: string; newToken: string }> {
    const hashedToken = this.hashToken(token);

    // Ищем токен в БД
    const refreshToken = await this.prisma.adminRefreshToken.findUnique({
      where: { token: hashedToken },
    });

    if (!refreshToken) {
      this.logger.warn('Admin refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Проверяем экспирацию
    if (refreshToken.expiresAt < new Date()) {
      this.logger.warn(
        `Admin refresh token expired for ${refreshToken.username}`,
      );
      // Удаляем истёкший токен
      await this.prisma.adminRefreshToken.delete({
        where: { id: refreshToken.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Токен валиден - выполняем ротацию
    const username = refreshToken.username;

    // Удаляем старый токен
    await this.prisma.adminRefreshToken.delete({
      where: { id: refreshToken.id },
    });

    // Создаём новый токен
    const newToken = await this.createRefreshToken(username, metadata);

    this.logger.log(`Rotated refresh token for admin ${username}`);
    return { username, newToken };
  }

  /**
   * Отзывает (удаляет) все refresh токены админа
   * Используется при logout
   */
  async revokeAllAdminTokens(username: string): Promise<void> {
    const result = await this.prisma.adminRefreshToken.deleteMany({
      where: { username },
    });

    this.logger.log(
      `Revoked ${result.count} refresh tokens for admin ${username}`,
    );
  }

  /**
   * Отзывает (удаляет) конкретный refresh token
   */
  async revokeToken(token: string): Promise<void> {
    const hashedToken = this.hashToken(token);

    await this.prisma.adminRefreshToken.deleteMany({
      where: { token: hashedToken },
    });

    this.logger.log('Revoked admin refresh token');
  }

  /**
   * Удаляет все истёкшие refresh токены (для периодической очистки)
   * Можно запускать через cron job
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.prisma.adminRefreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired admin refresh tokens`);
  }
}
