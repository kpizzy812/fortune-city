import { Controller, Get, Patch, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingsDto } from './dto/update-settings.dto';

// TODO: Add admin authentication guard
@Controller('admin/settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  async getSettings() {
    const settings = await this.settingsService.getSettings();
    return {
      maxGlobalTier: settings.maxGlobalTier,
      updatedAt: settings.updatedAt,
    };
  }

  @Patch()
  async updateSettings(@Body() dto: UpdateSettingsDto) {
    const settings = await this.settingsService.updateSettings(dto);
    return {
      maxGlobalTier: settings.maxGlobalTier,
      updatedAt: settings.updatedAt,
    };
  }
}
