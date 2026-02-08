import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SettingsService } from '../../settings/settings.service';
import {
  UpdateAllSettingsDto,
  SettingsResponse,
  GambleLevel,
} from './dto/settings.dto';
import { Decimal } from '@prisma/client/runtime/library';

const DEFAULT_SETTINGS_ID = 'default';

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settingsService: SettingsService,
  ) {}

  /**
   * Get all settings
   */
  async getSettings(): Promise<SettingsResponse> {
    const settings = await this.prisma.systemSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!settings) {
      throw new NotFoundException('System settings not found');
    }

    return this.formatSettingsResponse(settings);
  }

  /**
   * Update settings
   */
  async updateSettings(
    dto: UpdateAllSettingsDto,
    adminUser: string,
  ): Promise<SettingsResponse> {
    const existing = await this.prisma.systemSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!existing) {
      throw new NotFoundException('System settings not found');
    }

    const updateData: Record<string, unknown> = {};

    // Simple number fields
    if (dto.maxGlobalTier !== undefined) {
      updateData.maxGlobalTier = dto.maxGlobalTier;
    }
    if (dto.minWithdrawalAmount !== undefined) {
      updateData.minWithdrawalAmount = dto.minWithdrawalAmount;
    }
    if (dto.walletConnectFeeSol !== undefined) {
      updateData.walletConnectFeeSol = dto.walletConnectFeeSol;
    }
    if (dto.pawnshopCommission !== undefined) {
      updateData.pawnshopCommission = dto.pawnshopCommission;
    }
    if (dto.gambleWinMultiplier !== undefined) {
      updateData.gambleWinMultiplier = dto.gambleWinMultiplier;
    }
    if (dto.gambleLoseMultiplier !== undefined) {
      updateData.gambleLoseMultiplier = dto.gambleLoseMultiplier;
    }

    // JSON fields
    if (dto.minDepositAmounts !== undefined) {
      updateData.minDepositAmounts = dto.minDepositAmounts;
    }
    if (dto.taxRatesByTier !== undefined) {
      updateData.taxRatesByTier = dto.taxRatesByTier;
    }
    if (dto.referralRates !== undefined) {
      updateData.referralRates = dto.referralRates;
    }
    if (dto.reinvestReduction !== undefined) {
      updateData.reinvestReduction = dto.reinvestReduction;
    }
    if (dto.auctionCommissions !== undefined) {
      updateData.auctionCommissions = dto.auctionCommissions;
    }
    if (dto.earlySellCommissions !== undefined) {
      updateData.earlySellCommissions = dto.earlySellCommissions;
    }
    if (dto.gambleLevels !== undefined) {
      updateData.gambleLevels = dto.gambleLevels;
    }

    // Coin Box & Collector
    if (dto.coinBoxCapacityHours !== undefined) {
      updateData.coinBoxCapacityHours = dto.coinBoxCapacityHours;
    }
    if (dto.collectorHirePercent !== undefined) {
      updateData.collectorHirePercent = dto.collectorHirePercent;
    }
    if (dto.collectorSalaryPercent !== undefined) {
      updateData.collectorSalaryPercent = dto.collectorSalaryPercent;
    }

    // Prelaunch
    if (dto.isPrelaunch !== undefined) {
      updateData.isPrelaunch = dto.isPrelaunch;
    }
    if (dto.prelaunchEndsAt !== undefined) {
      updateData.prelaunchEndsAt = dto.prelaunchEndsAt
        ? new Date(dto.prelaunchEndsAt)
        : null;
    }

    const updated = await this.prisma.systemSettings.update({
      where: { id: DEFAULT_SETTINGS_ID },
      data: updateData,
    });

    // Log action
    await this.logAction('settings_updated', existing, updated, adminUser);

    // Invalidate cache in SettingsService
    this.settingsService.invalidateCache();

    return this.formatSettingsResponse(updated);
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults(adminUser: string): Promise<SettingsResponse> {
    const existing = await this.prisma.systemSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!existing) {
      throw new NotFoundException('System settings not found');
    }

    // Delete and recreate with defaults
    await this.prisma.systemSettings.delete({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    const created = await this.prisma.systemSettings.create({
      data: {
        id: DEFAULT_SETTINGS_ID,
        maxGlobalTier: 1,
        // All other fields have defaults in schema
      },
    });

    // Log action
    await this.logAction('settings_reset', existing, created, adminUser);

    // Invalidate cache
    this.settingsService.invalidateCache();

    return this.formatSettingsResponse(created);
  }

  /**
   * End prelaunch: activate frozen machines, reset maxGlobalTier to 1
   */
  async endPrelaunch(adminUser: string): Promise<{
    settings: SettingsResponse;
    machinesActivated: number;
  }> {
    const existing = await this.prisma.systemSettings.findUnique({
      where: { id: DEFAULT_SETTINGS_ID },
    });

    if (!existing) {
      throw new NotFoundException('System settings not found');
    }

    if (!existing.isPrelaunch) {
      throw new NotFoundException('System is not in prelaunch mode');
    }

    const now = new Date();

    // Find all frozen machines to calculate new dates
    const frozenMachines = await this.prisma.machine.findMany({
      where: { status: 'frozen' },
    });

    // Transaction: update settings + activate all frozen machines
    const updated = await this.prisma.$transaction(async (tx) => {
      // 1. Turn off prelaunch, reset maxGlobalTier to 1
      const updatedSettings = await tx.systemSettings.update({
        where: { id: DEFAULT_SETTINGS_ID },
        data: {
          isPrelaunch: false,
          maxGlobalTier: 1,
        },
      });

      // 2. Activate all frozen machines with fresh cycle
      for (const machine of frozenMachines) {
        const expiresAt = new Date(
          now.getTime() + machine.lifespanDays * 24 * 60 * 60 * 1000,
        );

        await tx.machine.update({
          where: { id: machine.id },
          data: {
            status: 'active',
            startedAt: now,
            expiresAt,
            lastCalculatedAt: now,
            coinBoxCurrent: 0,
          },
        });
      }

      return updatedSettings;
    });

    // Log action
    await this.logAction('prelaunch_ended', existing, updated, adminUser);

    // Invalidate cache
    this.settingsService.invalidateCache();

    return {
      settings: this.formatSettingsResponse(updated),
      machinesActivated: frozenMachines.length,
    };
  }

  /**
   * Format settings for response
   */
  private formatSettingsResponse(settings: {
    id: string;
    maxGlobalTier: number;
    minDepositAmounts: unknown;
    minWithdrawalAmount: Decimal;
    walletConnectFeeSol: Decimal;
    pawnshopCommission: Decimal;
    taxRatesByTier: unknown;
    referralRates: unknown;
    reinvestReduction: unknown;
    auctionCommissions: unknown;
    earlySellCommissions: unknown;
    gambleWinMultiplier: Decimal;
    gambleLoseMultiplier: Decimal;
    gambleLevels: unknown;
    coinBoxCapacityHours: number;
    collectorHirePercent: Decimal;
    collectorSalaryPercent: Decimal;
    isPrelaunch: boolean;
    prelaunchEndsAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }): SettingsResponse {
    return {
      id: settings.id,
      maxGlobalTier: settings.maxGlobalTier,
      minDepositAmounts: settings.minDepositAmounts as Record<string, number>,
      minWithdrawalAmount: Number(settings.minWithdrawalAmount),
      walletConnectFeeSol: Number(settings.walletConnectFeeSol),
      pawnshopCommission: Number(settings.pawnshopCommission),
      taxRatesByTier: settings.taxRatesByTier as Record<string, number>,
      referralRates: settings.referralRates as Record<string, number>,
      reinvestReduction: settings.reinvestReduction as Record<string, number>,
      auctionCommissions: settings.auctionCommissions as Record<string, number>,
      earlySellCommissions: settings.earlySellCommissions as Record<
        string,
        number
      >,
      gambleWinMultiplier: Number(settings.gambleWinMultiplier),
      gambleLoseMultiplier: Number(settings.gambleLoseMultiplier),
      gambleLevels: settings.gambleLevels as GambleLevel[],
      coinBoxCapacityHours: settings.coinBoxCapacityHours,
      collectorHirePercent: Number(settings.collectorHirePercent),
      collectorSalaryPercent: Number(settings.collectorSalaryPercent),
      isPrelaunch: settings.isPrelaunch,
      prelaunchEndsAt: settings.prelaunchEndsAt?.toISOString() ?? null,
      createdAt: settings.createdAt.toISOString(),
      updatedAt: settings.updatedAt.toISOString(),
    };
  }

  /**
   * Log admin action
   */
  private async logAction(
    action: string,
    oldValue: unknown,
    newValue: unknown,
    adminUser: string,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        adminAction: action,
        resource: 'settings',
        resourceId: DEFAULT_SETTINGS_ID,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        adminUser,
      },
    });
  }
}
