import { Module, Global } from '@nestjs/common';
import { SettingsService } from './settings.service';

/**
 * Global module for system settings.
 * Provides SettingsService for caching and basic settings access.
 * Full admin CRUD is handled by AdminSettingsController in AdminModule.
 */
@Global()
@Module({
  providers: [SettingsService],
  exports: [SettingsService],
})
export class SettingsModule {}
