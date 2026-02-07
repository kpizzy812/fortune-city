import { Controller, Get, Query } from '@nestjs/common';
import { ActivityService } from './activity.service';
import { ActivityItem } from './dto/activity.dto';

@Controller('activity')
export class ActivityController {
  constructor(private readonly activityService: ActivityService) {}

  /**
   * Get recent activity feed (public, no auth required)
   * Used for social proof on dashboard
   */
  @Get('feed')
  async getFeed(@Query('limit') limit?: string): Promise<ActivityItem[]> {
    const parsedLimit = limit ? Math.min(parseInt(limit, 10) || 30, 50) : 30;
    return this.activityService.getFeed(parsedLimit);
  }
}
