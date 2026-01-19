import { Injectable, UnauthorizedException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as crypto from 'crypto';

const REFRESH_TOKEN_LENGTH = 64; // 64 bytes = 128 hex characters
const REFRESH_TOKEN_EXPIRY_DAYS = 30; // 30 days

export interface RefreshTokenMetadata {
  ipAddress?: string;
  userAgent?: string;
}

@Injectable()
export class RefreshTokenService {
  private readonly logger = new Logger(RefreshTokenService.name);

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
   * Создаёт refresh token для пользователя
   * @returns Незахешированный токен (его нужно вернуть клиенту)
   */
  async createRefreshToken(
    userId: string,
    metadata?: RefreshTokenMetadata,
  ): Promise<string> {
    // Генерируем токен
    const token = this.generateToken();
    const hashedToken = this.hashToken(token);

    // Вычисляем дату экспирации
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + REFRESH_TOKEN_EXPIRY_DAYS);

    // Сохраняем в БД
    await this.prisma.refreshToken.create({
      data: {
        userId,
        token: hashedToken,
        expiresAt,
        ipAddress: metadata?.ipAddress,
        userAgent: metadata?.userAgent,
      },
    });

    this.logger.log(`Created refresh token for user ${userId}`);
    return token; // Возвращаем незахешированный токен
  }

  /**
   * Валидирует refresh token и возвращает userId
   * После валидации выполняет ротацию (удаляет старый, создаёт новый)
   * @returns {userId, newToken} - ID пользователя и новый refresh token
   */
  async validateAndRotateToken(
    token: string,
    metadata?: RefreshTokenMetadata,
  ): Promise<{ userId: string; newToken: string }> {
    const hashedToken = this.hashToken(token);

    // Ищем токен в БД
    const refreshToken = await this.prisma.refreshToken.findUnique({
      where: { token: hashedToken },
    });

    if (!refreshToken) {
      this.logger.warn('Refresh token not found');
      throw new UnauthorizedException('Invalid refresh token');
    }

    // Проверяем экспирацию
    if (refreshToken.expiresAt < new Date()) {
      this.logger.warn(`Refresh token expired for user ${refreshToken.userId}`);
      // Удаляем истёкший токен
      await this.prisma.refreshToken.delete({
        where: { id: refreshToken.id },
      });
      throw new UnauthorizedException('Refresh token expired');
    }

    // Токен валиден - выполняем ротацию
    const userId = refreshToken.userId;

    // Удаляем старый токен
    await this.prisma.refreshToken.delete({
      where: { id: refreshToken.id },
    });

    // Создаём новый токен
    const newToken = await this.createRefreshToken(userId, metadata);

    this.logger.log(`Rotated refresh token for user ${userId}`);
    return { userId, newToken };
  }

  /**
   * Отзывает (удаляет) все refresh токены пользователя
   * Используется при logout
   */
  async revokeAllUserTokens(userId: string): Promise<void> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });

    this.logger.log(`Revoked ${result.count} refresh tokens for user ${userId}`);
  }

  /**
   * Отзывает (удаляет) конкретный refresh token
   */
  async revokeToken(token: string): Promise<void> {
    const hashedToken = this.hashToken(token);

    await this.prisma.refreshToken.deleteMany({
      where: { token: hashedToken },
    });

    this.logger.log('Revoked refresh token');
  }

  /**
   * Удаляет все истёкшие refresh токены (для периодической очистки)
   * Можно запускать через cron job
   */
  async cleanupExpiredTokens(): Promise<void> {
    const result = await this.prisma.refreshToken.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired refresh tokens`);
  }
}
