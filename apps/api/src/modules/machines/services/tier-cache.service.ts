import {
  Injectable,
  OnModuleInit,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../prisma/prisma.service';
import { TierConfig } from '@prisma/client';
import { MACHINE_TIERS } from '@fortune-city/shared';

export interface TierConfigData {
  tier: number;
  name: string;
  emoji: string;
  price: number;
  lifespanDays: number;
  yieldPercent: number;
  imageUrl: string;
  isVisible: boolean;
  isPubliclyAvailable: boolean;
  sortOrder: number;
}

@Injectable()
export class TierCacheService implements OnModuleInit {
  private readonly logger = new Logger(TierCacheService.name);
  private tiersCache: Map<number, TierConfigData> = new Map();
  private allTiersCache: TierConfigData[] = [];
  private lastRefresh: Date | null = null;
  private isInitialized = false;

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.loadTiersFromDB();
    this.isInitialized = true;
    this.logger.log(`TierCacheService initialized with ${this.tiersCache.size} tiers`);
  }

  /**
   * Load tiers from database into cache
   * Falls back to hardcoded constants if DB is empty
   */
  async loadTiersFromDB(): Promise<void> {
    try {
      const dbTiers = await this.prisma.tierConfig.findMany({
        orderBy: { sortOrder: 'asc' },
      });

      if (dbTiers.length === 0) {
        this.logger.warn('No tiers in DB, using hardcoded fallback');
        this.loadFallbackTiers();
        return;
      }

      this.tiersCache.clear();
      this.allTiersCache = [];

      for (const tier of dbTiers) {
        const tierData = this.formatTier(tier);
        this.tiersCache.set(tier.tier, tierData);
        this.allTiersCache.push(tierData);
      }

      this.lastRefresh = new Date();
      this.logger.log(`Loaded ${dbTiers.length} tiers from database`);
    } catch (error) {
      this.logger.error('Failed to load tiers from DB, using fallback', error);
      this.loadFallbackTiers();
    }
  }

  /**
   * Load hardcoded tiers as fallback
   */
  private loadFallbackTiers(): void {
    this.tiersCache.clear();
    this.allTiersCache = [];

    for (const tier of MACHINE_TIERS) {
      const tierData: TierConfigData = {
        tier: tier.tier,
        name: tier.name,
        emoji: tier.emoji,
        price: tier.price,
        lifespanDays: tier.lifespanDays,
        yieldPercent: tier.yieldPercent,
        imageUrl: tier.imageUrl,
        isVisible: true,
        isPubliclyAvailable: tier.tier === 1,
        sortOrder: tier.tier,
      };
      this.tiersCache.set(tier.tier, tierData);
      this.allTiersCache.push(tierData);
    }

    this.lastRefresh = new Date();
  }

  /**
   * Format DB tier to TierConfigData
   */
  private formatTier(tier: TierConfig): TierConfigData {
    return {
      tier: tier.tier,
      name: tier.name,
      emoji: tier.emoji,
      price: Number(tier.price),
      lifespanDays: tier.lifespanDays,
      yieldPercent: tier.yieldPercent,
      imageUrl: tier.imageUrl ?? '',
      isVisible: tier.isVisible,
      isPubliclyAvailable: tier.isPubliclyAvailable,
      sortOrder: tier.sortOrder,
    };
  }

  /**
   * Get all tiers (visible only by default)
   */
  getAllTiers(includeHidden = false): TierConfigData[] {
    if (!this.isInitialized) {
      this.logger.warn('TierCacheService not initialized, returning empty array');
      return [];
    }

    if (includeHidden) {
      return [...this.allTiersCache];
    }

    return this.allTiersCache.filter((tier) => tier.isVisible);
  }

  /**
   * Get tier by number
   */
  getTier(tierNumber: number): TierConfigData | null {
    return this.tiersCache.get(tierNumber) ?? null;
  }

  /**
   * Get tier by number or throw error
   */
  getTierOrThrow(tierNumber: number): TierConfigData {
    const tier = this.getTier(tierNumber);
    if (!tier) {
      throw new NotFoundException(`Tier ${tierNumber} not found`);
    }
    return tier;
  }

  /**
   * Check if tier exists
   */
  hasTier(tierNumber: number): boolean {
    return this.tiersCache.has(tierNumber);
  }

  /**
   * Get tiers available for purchase (visible and publicly available OR user has unlocked)
   */
  getAvailableTiers(userMaxTierUnlocked: number): TierConfigData[] {
    return this.allTiersCache.filter((tier) => {
      if (!tier.isVisible) return false;
      // Available if publicly available OR user has unlocked this tier level
      return tier.isPubliclyAvailable || tier.tier <= userMaxTierUnlocked;
    });
  }

  /**
   * Get cache status
   */
  getCacheStatus(): {
    initialized: boolean;
    tiersCount: number;
    lastRefresh: Date | null;
  } {
    return {
      initialized: this.isInitialized,
      tiersCount: this.tiersCache.size,
      lastRefresh: this.lastRefresh,
    };
  }

  /**
   * Invalidate cache and reload from DB
   * Call this after admin makes changes to tiers
   */
  async invalidateCache(): Promise<void> {
    this.logger.log('Invalidating tier cache...');
    await this.loadTiersFromDB();
  }

  /**
   * Refresh cache every 5 minutes
   * This ensures eventual consistency if admin makes changes
   */
  @Cron(CronExpression.EVERY_5_MINUTES)
  async handleCacheRefresh(): Promise<void> {
    if (this.isInitialized) {
      await this.loadTiersFromDB();
    }
  }
}
