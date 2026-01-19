import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminTiersService } from './admin-tiers.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import {
  CreateTierDto,
  UpdateTierDto,
  UpdateVisibilityDto,
  UpdateAvailabilityDto,
} from './dto/tier.dto';

@Controller('admin/tiers')
@UseGuards(AdminJwtGuard)
export class AdminTiersController {
  constructor(private readonly tiersService: AdminTiersService) {}

  /**
   * GET /admin/tiers
   * Get all tiers (including hidden)
   */
  @Get()
  async getAllTiers() {
    return this.tiersService.getAllTiers();
  }

  /**
   * GET /admin/tiers/stats
   * Get tier statistics
   */
  @Get('stats')
  async getTierStats() {
    return this.tiersService.getTierStats();
  }

  /**
   * GET /admin/tiers/:tier
   * Get a single tier by number
   */
  @Get(':tier')
  async getTier(@Param('tier', ParseIntPipe) tier: number) {
    return this.tiersService.getTierByNumber(tier);
  }

  /**
   * POST /admin/tiers
   * Create a new tier
   */
  @Post()
  async createTier(@Body() dto: CreateTierDto, @Req() req: Request) {
    const adminUser = req.adminUser?.username ?? 'unknown';
    return this.tiersService.createTier(dto, adminUser);
  }

  /**
   * PUT /admin/tiers/:tier
   * Update an existing tier
   */
  @Put(':tier')
  async updateTier(
    @Param('tier', ParseIntPipe) tier: number,
    @Body() dto: UpdateTierDto,
    @Req() req: Request,
  ) {
    const adminUser = req.adminUser?.username ?? 'unknown';
    return this.tiersService.updateTier(tier, dto, adminUser);
  }

  /**
   * DELETE /admin/tiers/:tier
   * Delete a tier (soft delete if machines exist)
   */
  @Delete(':tier')
  async deleteTier(@Param('tier', ParseIntPipe) tier: number, @Req() req: Request) {
    const adminUser = req.adminUser?.username ?? 'unknown';
    return this.tiersService.deleteTier(tier, adminUser);
  }

  /**
   * PUT /admin/tiers/:tier/visibility
   * Update tier visibility (show/hide in shop)
   */
  @Put(':tier/visibility')
  async updateVisibility(
    @Param('tier', ParseIntPipe) tier: number,
    @Body() dto: UpdateVisibilityDto,
    @Req() req: Request,
  ) {
    const adminUser = req.adminUser?.username ?? 'unknown';
    return this.tiersService.updateVisibility(tier, dto.isVisible, adminUser);
  }

  /**
   * PUT /admin/tiers/:tier/availability
   * Update tier public availability (available without progression)
   */
  @Put(':tier/availability')
  async updateAvailability(
    @Param('tier', ParseIntPipe) tier: number,
    @Body() dto: UpdateAvailabilityDto,
    @Req() req: Request,
  ) {
    const adminUser = req.adminUser?.username ?? 'unknown';
    return this.tiersService.updateAvailability(tier, dto.isPubliclyAvailable, adminUser);
  }
}
