import {
  Controller,
  Post,
  Get,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuthService, AdminJwtPayload } from './admin-auth.service';
import { AdminLoginDto, AdminAuthResponseDto, RefreshTokenDto } from '../dto/admin-auth.dto';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly adminAuthService: AdminAuthService) {}

  /**
   * POST /admin/auth/login
   * Аутентификация админа
   */
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: AdminLoginDto,
    @Req() req: Request,
  ): Promise<AdminAuthResponseDto> {
    return this.adminAuthService.login(dto, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * GET /admin/auth/me
   * Проверка текущей сессии админа
   */
  @Get('me')
  @UseGuards(AdminJwtGuard)
  async getMe(@Req() req: Request): Promise<{ admin: { username: string } }> {
    const payload = req.adminUser as AdminJwtPayload;
    return {
      admin: {
        username: payload.username,
      },
    };
  }

  /**
   * POST /admin/auth/refresh
   * Обновление access token через refresh token
   */
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() req: Request,
  ): Promise<AdminAuthResponseDto> {
    return this.adminAuthService.refreshAccessToken(dto.refreshToken, {
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
    });
  }

  /**
   * POST /admin/auth/logout
   * Выход из системы (отзыв refresh токенов)
   */
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AdminJwtGuard)
  async logout(@Req() req: Request): Promise<{ success: boolean }> {
    const payload = req.adminUser as AdminJwtPayload;
    await this.adminAuthService.logout(payload.username);
    return { success: true };
  }
}
