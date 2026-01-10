import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import type { Request } from 'express';
import { AuthService, JwtPayload } from './auth.service';
import {
  TelegramInitDataDto,
  TelegramLoginWidgetDto,
  AuthResponseDto,
} from './dto/telegram-auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * POST /auth/telegram/init-data
   * Авторизация через Telegram Mini App
   */
  @Post('telegram/init-data')
  @HttpCode(HttpStatus.OK)
  async authWithInitData(
    @Body() dto: TelegramInitDataDto,
  ): Promise<AuthResponseDto> {
    return this.authService.authWithInitData(dto.initData);
  }

  /**
   * POST /auth/telegram/login-widget
   * Авторизация через Telegram Login Widget (Web)
   */
  @Post('telegram/login-widget')
  @HttpCode(HttpStatus.OK)
  async authWithLoginWidget(
    @Body() dto: TelegramLoginWidgetDto,
  ): Promise<AuthResponseDto> {
    return this.authService.authWithLoginWidget(dto);
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
      username: user.username,
      firstName: user.firstName,
      lastName: user.lastName,
      fortuneBalance: user.fortuneBalance.toString(),
      maxTierReached: user.maxTierReached,
      currentTaxRate: user.currentTaxRate.toString(),
    };
  }
}
