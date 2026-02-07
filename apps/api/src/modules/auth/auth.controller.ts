import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { AuthService, JwtPayload } from './auth.service';
import {
  TelegramInitDataDto,
  TelegramLoginWidgetDto,
  TelegramBotLoginDto,
  AuthResponseDto,
  SupabaseAuthDto,
  RefreshTokenDto,
} from './dto/telegram-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { SupabaseAuthService } from './supabase-auth.service';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
    private readonly supabaseAuthService: SupabaseAuthService,
  ) {}

  /**
   * POST /auth/telegram/init-data
   * Авторизация через Telegram Mini App
   */
  @Post('telegram/init-data')
  @HttpCode(HttpStatus.OK)
  async authWithInitData(
    @Body() dto: TelegramInitDataDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.authWithInitData(
      dto.initData,
      dto.referralCode,
      dto.rememberMe,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    );
  }

  /**
   * POST /auth/telegram/login-widget
   * Авторизация через Telegram Login Widget (Web)
   */
  @Post('telegram/login-widget')
  @HttpCode(HttpStatus.OK)
  async authWithLoginWidget(
    @Body() dto: TelegramLoginWidgetDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.authWithLoginWidget(
      dto,
      dto.referralCode,
      dto.rememberMe,
      {
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
      },
    );
  }

  /**
   * GET /auth/me
   * Получение текущего пользователя
   */
  @Get('me')
  @UseGuards(JwtAuthGuard)
  async getMe(@Req() req: Request): Promise<AuthResponseDto['user']> {
    const payload = req.user as JwtPayload;
    const user = await this.authService.getCurrentUser(payload);

    return {
      id: user.id,
      telegramId: user.telegramId,
      email: user.email,
      web3Address: user.web3Address,
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      fortuneBalance: user.fortuneBalance.toString(),
      referralBalance: user.referralBalance.toString(),
      maxTierReached: user.maxTierReached,
      maxTierUnlocked: user.maxTierUnlocked,
      currentTaxRate: user.currentTaxRate.toString(),
      taxDiscount: user.taxDiscount.toString(),
      referralCode: user.referralCode,
      fame: user.fame,
      totalFameEarned: user.totalFameEarned,
      loginStreak: user.loginStreak,
      lastLoginDate: user.lastLoginDate?.toISOString() ?? null,
    };
  }

  /**
   * POST /auth/supabase
   * Авторизация через Supabase (email magic link)
   */
  @Post('supabase')
  @HttpCode(HttpStatus.OK)
  async authWithSupabase(
    @Body() dto: SupabaseAuthDto,
  ): Promise<AuthResponseDto> {
    return this.authService.authWithSupabaseToken(
      dto.accessToken,
      dto.referralCode,
    );
  }

  /**
   * POST /auth/link-telegram
   * Привязка Telegram к текущему аккаунту
   */
  @Post('link-telegram')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async linkTelegram(
    @Req() req: Request,
    @Body() dto: TelegramLoginWidgetDto,
  ): Promise<AuthResponseDto> {
    const payload = req.user as JwtPayload;
    return this.authService.linkTelegram(payload.sub, dto);
  }

  /**
   * POST /auth/link-email
   * Привязка Email к текущему аккаунту (через Supabase token)
   */
  @Post('link-email')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async linkEmail(
    @Req() req: Request,
    @Body() dto: SupabaseAuthDto,
  ): Promise<AuthResponseDto> {
    const payload = req.user as JwtPayload;
    return this.authService.linkEmail(payload.sub, dto.accessToken);
  }

  /**
   * POST /auth/web3
   * Авторизация через Web3 (Solana wallet)
   */
  @Post('web3')
  @HttpCode(HttpStatus.OK)
  async authWithWeb3(@Body() dto: SupabaseAuthDto): Promise<AuthResponseDto> {
    return this.authService.authWithWeb3Token(
      dto.accessToken,
      dto.referralCode,
    );
  }

  /**
   * POST /auth/link-web3
   * Привязка Web3 кошелька к текущему аккаунту
   */
  @Post('link-web3')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async linkWeb3(
    @Req() req: Request,
    @Body() dto: SupabaseAuthDto,
  ): Promise<AuthResponseDto> {
    const payload = req.user as JwtPayload;
    return this.authService.linkWeb3(payload.sub, dto.accessToken);
  }

  /**
   * POST /auth/refresh
   * Обновление access token через refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AuthResponseDto> {
    return this.authService.refreshAccessToken(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * POST /auth/logout
   * Выход из системы (отзыв refresh токенов)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: Request): Promise<{ success: boolean }> {
    const payload = req.user as JwtPayload;
    await this.authService.logout(payload.sub);
    return { success: true };
  }

  /**
   * POST /auth/telegram-bot-login
   * Обмен одноразового токена из Telegram бота на JWT
   */
  @Post('telegram-bot-login')
  @HttpCode(HttpStatus.OK)
  async telegramBotLogin(
    @Body() dto: TelegramBotLoginDto,
  ): Promise<AuthResponseDto> {
    return this.authService.exchangeTelegramBotToken(dto.token);
  }

  /**
   * POST /auth/dev-login
   * Dev-only: авторизация тестового пользователя
   */
  @Post('dev-login')
  @HttpCode(HttpStatus.OK)
  async devLogin(): Promise<AuthResponseDto> {
    const nodeEnv = this.configService.get<string>('NODE_ENV', 'development');
    if (nodeEnv === 'production') {
      throw new ForbiddenException('Dev login is not available in production');
    }

    return this.authService.devLogin('123456789');
  }
}
