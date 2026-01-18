import {
  IsString,
  IsOptional,
  IsEnum,
  IsInt,
  Min,
  Max,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================
// Enums
// ============================================

export enum DepositSortField {
  createdAt = 'createdAt',
  amount = 'amount',
  amountUsd = 'amountUsd',
}

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export enum DepositStatusFilter {
  all = 'all',
  pending = 'pending',
  confirmed = 'confirmed',
  credited = 'credited',
  failed = 'failed',
}

// ============================================
// Filter & Pagination DTOs
// ============================================

export class DepositsFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string; // Search by user telegramId, username, tx signature

  @IsOptional()
  @IsEnum(DepositStatusFilter)
  status?: DepositStatusFilter = DepositStatusFilter.all;

  @IsOptional()
  @IsString()
  chain?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  method?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  offset?: number = 0;

  @IsOptional()
  @IsEnum(DepositSortField)
  sortBy?: DepositSortField = DepositSortField.createdAt;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;

  @IsOptional()
  @Transform(({ value }: { value: string | undefined }) =>
    value ? new Date(value) : undefined,
  )
  dateFrom?: Date;

  @IsOptional()
  @Transform(({ value }: { value: string | undefined }) =>
    value ? new Date(value) : undefined,
  )
  dateTo?: Date;
}

// ============================================
// Action DTOs
// ============================================

export class ManualCreditDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class RetryDepositDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ============================================
// Response Types
// ============================================

export interface DepositUserInfo {
  id: string;
  telegramId: string | null;
  username: string | null;
  firstName: string | null;
}

export interface DepositListItemResponse {
  id: string;
  user: DepositUserInfo;
  method: string;
  chain: string;
  currency: string;
  txSignature: string;
  amount: number;
  amountUsd: number;
  rateToUsd: number | null;
  memo: string | null;
  status: string;
  slot: string | null;
  confirmedAt: string | null;
  creditedAt: string | null;
  errorMessage: string | null;
  createdAt: string;
}

export interface DepositDetailResponse extends DepositListItemResponse {
  user: DepositUserInfo & {
    fortuneBalance: number;
    maxTierReached: number;
    isBanned: boolean;
  };
}

export interface DepositsListResponse {
  deposits: DepositListItemResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface DepositsStatsResponse {
  totalDeposits: number;
  pendingCount: number;
  confirmedCount: number;
  creditedCount: number;
  failedCount: number;
  totalAmountUsd: number;
  todayCount: number;
  todayAmountUsd: number;
  byCurrency: Record<string, { count: number; amount: number }>;
}
