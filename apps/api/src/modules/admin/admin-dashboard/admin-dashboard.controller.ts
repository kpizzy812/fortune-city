import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AdminDashboardService } from './admin-dashboard.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';

@Controller('admin/dashboard')
@UseGuards(AdminJwtGuard)
export class AdminDashboardController {
  constructor(private readonly dashboardService: AdminDashboardService) {}

  /**
   * GET /admin/dashboard/stats
   * Get dashboard statistics
   */
  @Get('stats')
  async getStats() {
    return this.dashboardService.getStats();
  }

  /**
   * GET /admin/dashboard/charts
   * Get chart data for the dashboard
   */
  @Get('charts')
  async getChartData(@Query('days') days?: string) {
    const daysNum = days ? parseInt(days, 10) : 30;
    return this.dashboardService.getChartData(Math.min(Math.max(daysNum, 7), 90));
  }

  /**
   * GET /admin/dashboard/tier-distribution
   * Get distribution of machines across tiers
   */
  @Get('tier-distribution')
  async getTierDistribution() {
    return this.dashboardService.getTierDistribution();
  }
}
