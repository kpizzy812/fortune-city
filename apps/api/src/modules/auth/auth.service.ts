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
import {
  UsersService,
  TelegramUserData,
  EmailUserData,
} from '../users/users.service';
import {
  TelegramLoginWidgetDto,
  AuthResponseDto,
} from './dto/telegram-auth.dto';
import { User } from '@prisma/client';
import { SupabaseAuthService } from './supabase-auth.service';
import {
  RefreshTokenService,
  RefreshTokenMetadata,
} from './refresh-token.service';

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
    private readonly refreshTokenService: RefreshTokenService,
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
    rememberMe?: boolean,
    metadata?: RefreshTokenMetadata,
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

      return this.authenticateUser(
        telegramUser,
        referralCode,
        rememberMe,
        metadata,
      );
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
    rememberMe?: boolean,
    metadata?: RefreshTokenMetadata,
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

    return this.authenticateUser(
      telegramUser,
      referralCode,
      rememberMe,
      metadata,
    );
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
    rememberMe?: boolean,
    metadata?: RefreshTokenMetadata,
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

    // Создать refresh token если rememberMe = true
    let refreshToken: string | undefined;
    if (rememberMe) {
      refreshToken = await this.refreshTokenService.createRefreshToken(
        user.id,
        metadata,
      );
    }

    return {
      accessToken,
      refreshToken,
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
      web3Address: user.web3Address,
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

  // ============ Web3 Auth ============

  /**
   * Авторизация через Web3 (Solana wallet)
   * Supabase уже проверил подпись через signInWithWeb3
   */
  async authWithWeb3Token(
    supabaseToken: string,
    referralCode?: string,
  ): Promise<AuthResponseDto> {
    // Валидируем Supabase JWT (он уже проверил подпись wallet)
    const supabasePayload =
      await this.supabaseAuthService.verifyToken(supabaseToken);

    // Web3 wallet address находится в user_metadata, не в sub
    const walletAddress =
      this.supabaseAuthService.getWalletAddress(supabasePayload);

    if (!walletAddress) {
      this.logger.error(
        `Wallet address not found. Payload sub: ${supabasePayload.sub}`,
      );
      throw new UnauthorizedException('Wallet address not found in token');
    }

    this.logger.log(`Web3 auth with wallet: ${walletAddress}`);

    const { user } = await this.usersService.findOrCreateFromWeb3(
      walletAddress,
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
   * Привязка Web3 кошелька к текущему пользователю
   */
  async linkWeb3(
    userId: string,
    supabaseToken: string,
  ): Promise<AuthResponseDto> {
    // Валидируем Supabase токен
    const supabasePayload =
      await this.supabaseAuthService.verifyToken(supabaseToken);

    // Web3 wallet address находится в user_metadata, не в sub
    const walletAddress =
      this.supabaseAuthService.getWalletAddress(supabasePayload);

    if (!walletAddress) {
      this.logger.error(
        `Wallet address not found for linking. Payload sub: ${supabasePayload.sub}`,
      );
      throw new UnauthorizedException('Wallet address not found in token');
    }

    this.logger.log(`Linking Web3 wallet ${walletAddress} to user ${userId}`);

    const user = await this.usersService.linkWeb3ToUser(userId, walletAddress);

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

  /**
   * Обновление access token через refresh token
   */
  async refreshAccessToken(
    refreshToken: string,
    metadata?: RefreshTokenMetadata,
  ): Promise<AuthResponseDto> {
    // Валидируем и ротируем refresh token
    const { userId, newToken } =
      await this.refreshTokenService.validateAndRotateToken(
        refreshToken,
        metadata,
      );

    // Получаем пользователя
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    // Создаём новый access token
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email ?? undefined,
      telegramId: user.telegramId ?? undefined,
      username: user.username ?? undefined,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      refreshToken: newToken,
      user: this.formatUserResponse(user),
    };
  }

  /**
   * Выход из системы (отзыв всех refresh токенов пользователя)
   */
  async logout(userId: string): Promise<void> {
    await this.refreshTokenService.revokeAllUserTokens(userId);
    this.logger.log(`User ${userId} logged out`);
  }
}
