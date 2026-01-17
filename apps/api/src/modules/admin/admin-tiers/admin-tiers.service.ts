import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { TierCacheService } from '../../machines/services/tier-cache.service';
import {
  CreateTierDto,
  UpdateTierDto,
  TierResponse,
} from './dto/tier.dto';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class AdminTiersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tierCacheService: TierCacheService,
  ) {}

  /**
   * Get all tiers (including hidden ones)
   */
  async getAllTiers(): Promise<TierResponse[]> {
    const tiers = await this.prisma.tierConfig.findMany({
      orderBy: { sortOrder: 'asc' },
    });

    return tiers.map(this.formatTierResponse);
  }

  /**
   * Get a single tier by tier number
   */
  async getTierByNumber(tierNumber: number): Promise<TierResponse> {
    const tier = await this.prisma.tierConfig.findUnique({
      where: { tier: tierNumber },
    });

    if (!tier) {
      throw new NotFoundException(`Tier ${tierNumber} not found`);
    }

    return this.formatTierResponse(tier);
  }

  /**
   * Create a new tier
   */
  async createTier(dto: CreateTierDto): Promise<TierResponse> {
    // Check if tier number already exists
    const existing = await this.prisma.tierConfig.findUnique({
      where: { tier: dto.tier },
    });

    if (existing) {
      throw new ConflictException(`Tier ${dto.tier} already exists`);
    }

    const tier = await this.prisma.tierConfig.create({
      data: {
        tier: dto.tier,
        name: dto.name,
        emoji: dto.emoji,
        price: dto.price,
        lifespanDays: dto.lifespanDays,
        yieldPercent: dto.yieldPercent,
        imageUrl: dto.imageUrl,
        isVisible: dto.isVisible ?? true,
        isPubliclyAvailable: dto.isPubliclyAvailable ?? false,
        sortOrder: dto.sortOrder ?? dto.tier,
      },
    });

    // Log action
    await this.logAction('tier_created', 'tier', String(dto.tier), null, tier);

    // Invalidate cache immediately
    await this.tierCacheService.invalidateCache();

    return this.formatTierResponse(tier);
  }

  /**
   * Update an existing tier
   */
  async updateTier(
    tierNumber: number,
    dto: UpdateTierDto,
  ): Promise<TierResponse> {
    const existing = await this.prisma.tierConfig.findUnique({
      where: { tier: tierNumber },
    });

    if (!existing) {
      throw new NotFoundException(`Tier ${tierNumber} not found`);
    }

    const updated = await this.prisma.tierConfig.update({
      where: { tier: tierNumber },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.emoji !== undefined && { emoji: dto.emoji }),
        ...(dto.price !== undefined && { price: dto.price }),
        ...(dto.lifespanDays !== undefined && { lifespanDays: dto.lifespanDays }),
        ...(dto.yieldPercent !== undefined && { yieldPercent: dto.yieldPercent }),
        ...(dto.imageUrl !== undefined && { imageUrl: dto.imageUrl }),
        ...(dto.isVisible !== undefined && { isVisible: dto.isVisible }),
        ...(dto.isPubliclyAvailable !== undefined && {
          isPubliclyAvailable: dto.isPubliclyAvailable,
        }),
        ...(dto.sortOrder !== undefined && { sortOrder: dto.sortOrder }),
      },
    });

    // Log action
    await this.logAction(
      'tier_updated',
      'tier',
      String(tierNumber),
      existing,
      updated,
    );

    // Invalidate cache immediately
    await this.tierCacheService.invalidateCache();

    return this.formatTierResponse(updated);
  }

  /**
   * Delete a tier (soft delete by hiding, or hard delete if no machines use it)
   */
  async deleteTier(tierNumber: number): Promise<{ success: boolean; message: string }> {
    const existing = await this.prisma.tierConfig.findUnique({
      where: { tier: tierNumber },
    });

    if (!existing) {
      throw new NotFoundException(`Tier ${tierNumber} not found`);
    }

    // Check if any machines use this tier
    const machinesCount = await this.prisma.machine.count({
      where: { tier: tierNumber },
    });

    if (machinesCount > 0) {
      // Soft delete - just hide it
      await this.prisma.tierConfig.update({
        where: { tier: tierNumber },
        data: { isVisible: false },
      });

      await this.logAction(
        'tier_hidden',
        'tier',
        String(tierNumber),
        existing,
        { ...existing, isVisible: false },
      );

      // Invalidate cache immediately
      await this.tierCacheService.invalidateCache();

      return {
        success: true,
        message: `Tier ${tierNumber} hidden (${machinesCount} machines exist)`,
      };
    }

    // Hard delete - no machines use it
    await this.prisma.tierConfig.delete({
      where: { tier: tierNumber },
    });

    await this.logAction('tier_deleted', 'tier', String(tierNumber), existing, null);

    // Invalidate cache immediately
    await this.tierCacheService.invalidateCache();

    return {
      success: true,
      message: `Tier ${tierNumber} deleted`,
    };
  }

  /**
   * Update tier visibility
   */
  async updateVisibility(
    tierNumber: number,
    isVisible: boolean,
  ): Promise<TierResponse> {
    const existing = await this.prisma.tierConfig.findUnique({
      where: { tier: tierNumber },
    });

    if (!existing) {
      throw new NotFoundException(`Tier ${tierNumber} not found`);
    }

    const updated = await this.prisma.tierConfig.update({
      where: { tier: tierNumber },
      data: { isVisible },
    });

    await this.logAction(
      isVisible ? 'tier_shown' : 'tier_hidden',
      'tier',
      String(tierNumber),
      { isVisible: existing.isVisible },
      { isVisible },
    );

    // Invalidate cache immediately
    await this.tierCacheService.invalidateCache();

    return this.formatTierResponse(updated);
  }

  /**
   * Update tier public availability
   */
  async updateAvailability(
    tierNumber: number,
    isPubliclyAvailable: boolean,
  ): Promise<TierResponse> {
    const existing = await this.prisma.tierConfig.findUnique({
      where: { tier: tierNumber },
    });

    if (!existing) {
      throw new NotFoundException(`Tier ${tierNumber} not found`);
    }

    const updated = await this.prisma.tierConfig.update({
      where: { tier: tierNumber },
      data: { isPubliclyAvailable },
    });

    await this.logAction(
      isPubliclyAvailable ? 'tier_made_public' : 'tier_made_private',
      'tier',
      String(tierNumber),
      { isPubliclyAvailable: existing.isPubliclyAvailable },
      { isPubliclyAvailable },
    );

    // Invalidate cache immediately
    await this.tierCacheService.invalidateCache();

    return this.formatTierResponse(updated);
  }

  /**
   * Get tier statistics
   */
  async getTierStats(): Promise<{
    total: number;
    visible: number;
    hidden: number;
    publiclyAvailable: number;
  }> {
    const [total, visible, publiclyAvailable] = await Promise.all([
      this.prisma.tierConfig.count(),
      this.prisma.tierConfig.count({ where: { isVisible: true } }),
      this.prisma.tierConfig.count({ where: { isPubliclyAvailable: true } }),
    ]);

    return {
      total,
      visible,
      hidden: total - visible,
      publiclyAvailable,
    };
  }

  /**
   * Format tier response
   */
  private formatTierResponse(tier: {
    id: string;
    tier: number;
    name: string;
    emoji: string;
    price: Decimal;
    lifespanDays: number;
    yieldPercent: number;
    imageUrl: string | null;
    isVisible: boolean;
    isPubliclyAvailable: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
  }): TierResponse {
    return {
      id: tier.id,
      tier: tier.tier,
      name: tier.name,
      emoji: tier.emoji,
      price: Number(tier.price),
      lifespanDays: tier.lifespanDays,
      yieldPercent: tier.yieldPercent,
      imageUrl: tier.imageUrl,
      isVisible: tier.isVisible,
      isPubliclyAvailable: tier.isPubliclyAvailable,
      sortOrder: tier.sortOrder,
      createdAt: tier.createdAt.toISOString(),
      updatedAt: tier.updatedAt.toISOString(),
    };
  }

  /**
   * Log admin action to audit log
   */
  private async logAction(
    action: string,
    resource: string,
    resourceId: string,
    oldValue: unknown,
    newValue: unknown,
  ): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        adminAction: action,
        resource,
        resourceId,
        oldValue: oldValue ? JSON.parse(JSON.stringify(oldValue)) : null,
        newValue: newValue ? JSON.parse(JSON.stringify(newValue)) : null,
        adminUser: 'admin', // TODO: Get from request context
      },
    });
  }
}
