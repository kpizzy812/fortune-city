import {
  Controller,
  Get,
  UseGuards,
} from '@nestjs/common';
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
}
