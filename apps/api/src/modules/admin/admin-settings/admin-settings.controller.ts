import {
  Controller,
  Get,
  Put,
  Post,
  Body,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AdminSettingsService } from './admin-settings.service';
import { UpdateAllSettingsDto, SettingsResponse } from './dto/settings.dto';

@Controller('admin/settings')
@UseGuards(AdminJwtGuard)
export class AdminSettingsController {
  constructor(private readonly settingsService: AdminSettingsService) {}

  /**
   * GET /admin/settings
   * Get all system settings
   */
  @Get()
  async getSettings(): Promise<SettingsResponse> {
    return this.settingsService.getSettings();
  }

  /**
   * PUT /admin/settings
   * Update system settings
   */
  @Put()
  async updateSettings(
    @Body() dto: UpdateAllSettingsDto,
  ): Promise<SettingsResponse> {
    return this.settingsService.updateSettings(dto);
  }

  /**
   * POST /admin/settings/reset
   * Reset all settings to defaults
   */
  @Post('reset')
  @HttpCode(HttpStatus.OK)
  async resetToDefaults(): Promise<SettingsResponse> {
    return this.settingsService.resetToDefaults();
  }
}
