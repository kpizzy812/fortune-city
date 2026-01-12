import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SystemSettings } from '@prisma/client';

const DEFAULT_SETTINGS_ID = 'default';

@Injectable()
export class SettingsService implements OnModuleInit {
  private cachedSettings: SystemSettings | null = null;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    // Ensure settings exist on startup
    await this.ensureSettingsExist();
  }

  private async ensureSettingsExist(): Promise<SystemSettings> {
    let settings = await this.prisma.systemSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!settings) {
      settings = await this.prisma.systemSettings.create({
        data: {
          id: DEFAULT_SETTINGS_ID,
          maxGlobalTier: 1,
        },
      });
    }

    this.cachedSettings = settings;
    return settings;
  }

  async getSettings(): Promise<SystemSettings> {
    if (this.cachedSettings) {
      return this.cachedSettings;
    }
    return this.ensureSettingsExist();
  }

  async getMaxGlobalTier(): Promise<number> {
    const settings = await this.getSettings();
    return settings.maxGlobalTier;
  }

  async updateMaxGlobalTier(maxGlobalTier: number): Promise<SystemSettings> {
    if (maxGlobalTier < 1 || maxGlobalTier > 10) {
      throw new Error('maxGlobalTier must be between 1 and 10');
    }

    const settings = await this.prisma.systemSettings.update({
      where: { id: DEFAULT_SETTINGS_ID },
      data: { maxGlobalTier },
    });

    this.cachedSettings = settings;
    return settings;
  }

  async updateSettings(
    data: Partial<Pick<SystemSettings, 'maxGlobalTier'>>,
  ): Promise<SystemSettings> {
    const settings = await this.prisma.systemSettings.update({
      where: { id: DEFAULT_SETTINGS_ID },
      data,
    });

    this.cachedSettings = settings;
    return settings;
  }

  invalidateCache(): void {
    this.cachedSettings = null;
  }
}
