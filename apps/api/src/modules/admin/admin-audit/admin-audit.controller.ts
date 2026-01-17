import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { AdminAuditService } from './admin-audit.service';
import { AdminJwtGuard } from '../guards/admin-jwt.guard';
import { AuditFilterDto } from './dto/audit.dto';

@Controller('admin/audit')
@UseGuards(AdminJwtGuard)
export class AdminAuditController {
  constructor(private readonly auditService: AdminAuditService) {}

  /**
   * GET /admin/audit
   * Get paginated list of audit logs with filters
   */
  @Get()
  async getAuditLogs(@Query() filters: AuditFilterDto) {
    return this.auditService.getAuditLogs(filters);
  }

  /**
   * GET /admin/audit/stats
   * Get audit statistics
   */
  @Get('stats')
  async getStats() {
    return this.auditService.getStats();
  }

  /**
   * GET /admin/audit/resource/:resource/:resourceId
   * Get audit history for a specific resource
   */
  @Get('resource/:resource/:resourceId')
  async getResourceHistory(
    @Param('resource') resource: string,
    @Param('resourceId') resourceId: string,
  ) {
    return this.auditService.getResourceHistory(resource, resourceId);
  }
}
