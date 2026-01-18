import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { validate, parse } from '@tma.js/init-data-node';
import * as crypto from 'crypto';
import { UsersService, TelegramUserData, EmailUserData } from '../users/users.service';
import {
  TelegramLoginWidgetDto,
  AuthResponseDto,
} from './dto/telegram-auth.dto';
import { User } from '@prisma/client';
import { SupabaseAuthService } from './supabase-auth.service';

export interface JwtPayload {
  sub: string; // user.id
  telegramId?: string; // Теперь опциональный
  email?: string; // Новое поле
  username?: string;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private readonly botToken: string;
  private readonly jwtExpiresIn: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly jwtService: JwtService,
    private readonly usersService: UsersService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {
    this.botToken = this.configService.getOrThrow<string>('TELEGRAM_BOT_TOKEN');
    this.jwtExpiresIn = this.configService.get<string>('JWT_EXPIRES_IN', '7d');
  }

  /**
   * Авторизация через Telegram Mini App (initData)
   */
  async authWithInitData(
    initData: string,
    referralCode?: string,
  ): Promise<AuthResponseDto> {
    try {
      // Валидация initData
      validate(initData, this.botToken, {
        expiresIn: 3600, // 1 час
      });

      // Парсинг данных
      const parsedData = parse(initData);

      if (!parsedData.user) {
        throw new UnauthorizedException('User data not found in initData');
      }

      const user = parsedData.user;
      const telegramUser: TelegramUserData = {
        id: user.id,
        username: user.username,
        first_name: user.firstName as string | undefined,
        last_name: user.lastName as string | undefined,
      };

      return this.authenticateUser(telegramUser, referralCode);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(`InitData validation failed: ${message}`);
      throw new UnauthorizedException('Invalid initData');
    }
  }

  /**
   * Авторизация через Telegram Login Widget (Web)
   * https://core.telegram.org/widgets/login#checking-authorization
   */
  async authWithLoginWidget(
    data: TelegramLoginWidgetDto,
    referralCode?: string,
  ): Promise<AuthResponseDto> {
    // Проверка времени авторизации (не старше 1 дня)
    const authDate = data.auth_date;
    const now = Math.floor(Date.now() / 1000);

    if (now - authDate > 86400) {
      throw new UnauthorizedException('Auth data is too old');
    }

    // Проверка хеша
    const isValid = this.verifyLoginWidgetHash(data);

    if (!isValid) {
      throw new UnauthorizedException('Invalid hash');
    }

    const telegramUser: TelegramUserData = {
      id: data.id,
      username: data.username,
      first_name: data.first_name,
      last_name: data.last_name,
    };

    return this.authenticateUser(telegramUser, referralCode);
  }

  /**
   * Верификация хеша от Telegram Login Widget
   */
  private verifyLoginWidgetHash(data: TelegramLoginWidgetDto): boolean {
    const { hash, ...dataWithoutHash } = data;

    // Создаём строку для проверки
    const dataCheckString = Object.keys(dataWithoutHash)
      .sort()
      .filter(
        (key) =>
          dataWithoutHash[key as keyof typeof dataWithoutHash] !== undefined,
      )
      .map(
        (key) =>
          `${key}=${dataWithoutHash[key as keyof typeof dataWithoutHash]}`,
      )
      .join('\n');

    // Создаём secret key из bot token
    const secretKey = crypto
      .createHash('sha256')
      .update(this.botToken)
      .digest();

    // Вычисляем hash
    const calculatedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    return calculatedHash === hash;
  }

  /**
   * Общая логика аутентификации пользователя
   */
  private async authenticateUser(
    telegramUser: TelegramUserData,
    referralCode?: string,
  ): Promise<AuthResponseDto> {
    // Найти или создать пользователя (referralCode применяется только для новых)
    const { user } = await this.usersService.findOrCreateFromTelegram(
      telegramUser,
      referralCode,
    );

    // Создать JWT
    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId ?? undefined,
      username: user.username ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Валидация JWT и получение пользователя
   */
  validateJwt(token: string): JwtPayload {
    try {
      return this.jwtService.verify<JwtPayload>(token);
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  /**
   * Получение текущего пользователя по payload
   */
  async getCurrentUser(payload: JwtPayload): Promise<User> {
    const user = await this.usersService.findById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    return user;
  }

  /**
   * Форматирование ответа пользователя
   */
  private formatUserResponse(user: User): AuthResponseDto['user'] {
    return {
      id: user.id,
      telegramId: user.telegramId,
      email: user.email,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fortuneBalance: user.fortuneBalance.toString(),
      referralBalance: user.referralBalance.toString(),
      maxTierReached: user.maxTierReached,
      currentTaxRate: user.currentTaxRate.toString(),
      referralCode: user.referralCode,
    };
  }

  // ============ Email/Supabase Auth ============

  /**
   * Авторизация через Supabase (email/magic link)
   */
  async authWithSupabaseToken(
    supabaseToken: string,
    referralCode?: string,
  ): Promise<AuthResponseDto> {
    // Валидируем Supabase JWT
    const supabasePayload =
      await this.supabaseAuthService.verifyToken(supabaseToken);

    if (!supabasePayload.email) {
      throw new UnauthorizedException('Email not found in token');
    }

    const emailUser: EmailUserData = {
      supabaseId: supabasePayload.sub,
      email: supabasePayload.email,
      emailVerified: supabasePayload.email_verified ?? false,
    };

    const { user } = await this.usersService.findOrCreateFromEmail(
      emailUser,
      referralCode,
    );

    // Создаем собственный JWT
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      telegramId: user.telegramId ?? undefined,
      username: user.username ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Привязка Telegram к текущему пользователю
   */
  async linkTelegram(
    userId: string,
    telegramData: TelegramLoginWidgetDto,
  ): Promise<AuthResponseDto> {
    // Проверяем hash
    const isValid = this.verifyLoginWidgetHash(telegramData);
    if (!isValid) {
      throw new UnauthorizedException('Invalid Telegram hash');
    }

    const telegramUser: TelegramUserData = {
      id: telegramData.id,
      username: telegramData.username,
      first_name: telegramData.first_name,
      last_name: telegramData.last_name,
    };

    const user = await this.usersService.linkTelegramToUser(
      userId,
      telegramUser,
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      telegramId: user.telegramId ?? undefined,
      username: user.username ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Привязка Email к текущему пользователю
   */
  async linkEmail(
    userId: string,
    supabaseToken: string,
  ): Promise<AuthResponseDto> {
    // Валидируем Supabase токен
    const supabasePayload =
      await this.supabaseAuthService.verifyToken(supabaseToken);

    if (!supabasePayload.email) {
      throw new UnauthorizedException('Email not found in token');
    }

    const user = await this.usersService.linkEmailToUser(
      userId,
      supabasePayload.email,
      supabasePayload.sub,
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      telegramId: user.telegramId ?? undefined,
      username: user.username ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Dev-only: авторизация по telegram ID без проверки
   */
  async devLogin(telegramId: string): Promise<AuthResponseDto> {
    const user = await this.usersService.findByTelegramId(telegramId);

    if (!user) {
      throw new NotFoundException('Test user not found');
    }

    const payload: JwtPayload = {
      sub: user.id,
      telegramId: user.telegramId ?? undefined,
      username: user.username ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: this.formatUserResponse(user),
    };
  }
}
