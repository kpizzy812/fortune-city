import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  AuditFilterDto,
  AuditLogItemResponse,
  AuditLogsListResponse,
  AuditStatsResponse,
  SortOrder,
} from './dto/audit.dto';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Get paginated list of audit logs with filters
   */
  async getAuditLogs(filters: AuditFilterDto): Promise<AuditLogsListResponse> {
    const {
      action,
      resource,
      resourceId,
      adminUser,
      dateFrom,
      dateTo,
      limit = 50,
      offset = 0,
      sortOrder = SortOrder.desc,
    } = filters;

    // Build where clause
    const where: Prisma.AuditLogWhereInput = {};

    if (action) {
      where.adminAction = { contains: action, mode: 'insensitive' };
    }

    if (resource) {
      where.resource = resource;
    }

    if (resourceId) {
      where.resourceId = resourceId;
    }

    if (adminUser) {
      where.adminUser = { contains: adminUser, mode: 'insensitive' };
    }

    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = dateFrom;
      }
      if (dateTo) {
        where.createdAt.lte = dateTo;
      }
    }

    // Fetch audit logs
    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        skip: offset,
        take: limit,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map((log) => this.formatAuditLogItem(log)),
      total,
      limit,
      offset,
    };
  }

  /**
   * Get audit statistics
   */
  async getStats(): Promise<AuditStatsResponse> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalLogs, todayCount, byActionRaw, byResourceRaw, recentLogs] =
      await Promise.all([
        this.prisma.auditLog.count(),
        this.prisma.auditLog.count({
          where: { createdAt: { gte: today } },
        }),
        this.prisma.auditLog.groupBy({
          by: ['adminAction'],
          _count: true,
          orderBy: { _count: { adminAction: 'desc' } },
          take: 10,
        }),
        this.prisma.auditLog.groupBy({
          by: ['resource'],
          _count: true,
        }),
        this.prisma.auditLog.findMany({
          orderBy: { createdAt: 'desc' },
          take: 10,
        }),
      ]);

    const byAction: Record<string, number> = {};
    byActionRaw.forEach((item) => {
      byAction[item.adminAction] = item._count;
    });

    const byResource: Record<string, number> = {};
    byResourceRaw.forEach((item) => {
      byResource[item.resource] = item._count;
    });

    return {
      totalLogs,
      todayCount,
      byAction,
      byResource,
      recentActions: recentLogs.map((log) => this.formatAuditLogItem(log)),
    };
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceHistory(
    resource: string,
    resourceId: string,
  ): Promise<AuditLogItemResponse[]> {
    const logs = await this.prisma.auditLog.findMany({
      where: { resource, resourceId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });

    return logs.map((log) => this.formatAuditLogItem(log));
  }

  // ============================================
  // Private helpers
  // ============================================

  private formatAuditLogItem(log: {
    id: string;
    adminAction: string;
    resource: string;
    resourceId: string | null;
    oldValue: Prisma.JsonValue | null;
    newValue: Prisma.JsonValue | null;
    ipAddress: string | null;
    adminUser: string | null;
    createdAt: Date;
  }): AuditLogItemResponse {
    return {
      id: log.id,
      adminAction: log.adminAction,
      resource: log.resource,
      resourceId: log.resourceId,
      oldValue: log.oldValue,
      newValue: log.newValue,
      ipAddress: log.ipAddress,
      adminUser: log.adminUser,
      createdAt: log.createdAt.toISOString(),
    };
  }
}
