import { IsString, IsOptional, IsEnum, IsInt, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================
// Enums
// ============================================

export enum AuditSortField {
  createdAt = 'createdAt',
}

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

// ============================================
// Filter & Pagination DTOs
// ============================================

export class AuditFilterDto {
  @IsOptional()
  @IsString()
  action?: string; // Filter by action type

  @IsOptional()
  @IsString()
  resource?: string; // Filter by resource type (user, withdrawal, deposit, tier, settings)

  @IsOptional()
  @IsString()
  resourceId?: string; // Filter by specific resource ID

  @IsOptional()
  @IsString()
  adminUser?: string; // Filter by admin username

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 50;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;

  @IsOptional()
  @Transform(({ value }: { value: string | undefined }) => (value ? new Date(value) : undefined))
  dateFrom?: Date;

  @IsOptional()
  @Transform(({ value }: { value: string | undefined }) => (value ? new Date(value) : undefined))
  dateTo?: Date;
}

// ============================================
// Response Types
// ============================================

export interface AuditLogItemResponse {
  id: string;
  adminAction: string;
  resource: string;
  resourceId: string | null;
  oldValue: unknown;
  newValue: unknown;
  ipAddress: string | null;
  adminUser: string | null;
  createdAt: string;
}

export interface AuditLogsListResponse {
  logs: AuditLogItemResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface AuditStatsResponse {
  totalLogs: number;
  todayCount: number;
  byAction: Record<string, number>;
  byResource: Record<string, number>;
  recentActions: AuditLogItemResponse[];
}
