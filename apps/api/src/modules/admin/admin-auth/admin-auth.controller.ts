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
import { AdminLoginDto, AdminAuthResponseDto } from '../dto/admin-auth.dto';
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
  async login(@Body() dto: AdminLoginDto): Promise<AdminAuthResponseDto> {
    return this.adminAuthService.login(dto);
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
}
