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

export enum WithdrawalSortField {
  createdAt = 'createdAt',
  requestedAmount = 'requestedAmount',
  netAmount = 'netAmount',
}

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export enum WithdrawalStatusFilter {
  all = 'all',
  pending = 'pending',
  processing = 'processing',
  completed = 'completed',
  failed = 'failed',
  cancelled = 'cancelled',
}

// ============================================
// Filter & Pagination DTOs
// ============================================

export class WithdrawalsFilterDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string; // Search by user telegramId, username, wallet address

  @IsOptional()
  @IsEnum(WithdrawalStatusFilter)
  status?: WithdrawalStatusFilter = WithdrawalStatusFilter.all;

  @IsOptional()
  @IsString()
  chain?: string;

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
  @IsEnum(WithdrawalSortField)
  sortBy?: WithdrawalSortField = WithdrawalSortField.createdAt;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  dateFrom?: Date;

  @IsOptional()
  @Transform(({ value }) => (value ? new Date(value) : undefined))
  dateTo?: Date;
}

// ============================================
// Action DTOs
// ============================================

export class ApproveWithdrawalDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class RejectWithdrawalDto {
  @IsString()
  @MaxLength(500)
  reason: string;
}

export class ProcessWithdrawalDto {
  @IsString()
  txSignature: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ============================================
// Response Types
// ============================================

export interface WithdrawalUserInfo {
  id: string;
  telegramId: string | null;
  username: string | null;
  firstName: string | null;
}

export interface WithdrawalListItemResponse {
  id: string;
  user: WithdrawalUserInfo;
  method: string;
  chain: string;
  currency: string;
  walletAddress: string;
  requestedAmount: number;
  fromFreshDeposit: number;
  fromProfit: number;
  taxAmount: number;
  taxRate: number;
  netAmount: number;
  usdtAmount: number;
  feeSolAmount: number | null;
  txSignature: string | null;
  status: string;
  errorMessage: string | null;
  processedAt: string | null;
  createdAt: string;
}

export interface WithdrawalDetailResponse extends WithdrawalListItemResponse {
  user: WithdrawalUserInfo & {
    fortuneBalance: number;
    maxTierReached: number;
    isBanned: boolean;
  };
}

export interface WithdrawalsListResponse {
  withdrawals: WithdrawalListItemResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface WithdrawalsStatsResponse {
  totalWithdrawals: number;
  pendingCount: number;
  processingCount: number;
  completedCount: number;
  failedCount: number;
  cancelledCount: number;
  totalRequestedAmount: number;
  totalNetAmount: number;
  totalTaxCollected: number;
  todayCount: number;
  todayAmount: number;
}
