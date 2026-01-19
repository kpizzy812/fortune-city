import {
  IsString,
  IsOptional,
  IsBoolean,
  IsInt,
  IsNumber,
  IsEnum,
  Min,
  Max,
  MinLength,
  MaxLength,
} from 'class-validator';
import { Type, Transform } from 'class-transformer';

// ============================================
// Filter & Pagination DTOs
// ============================================

export enum UserSortField {
  createdAt = 'createdAt',
  fortuneBalance = 'fortuneBalance',
  maxTierReached = 'maxTierReached',
  username = 'username',
}

export enum SortOrder {
  asc = 'asc',
  desc = 'desc',
}

export class UsersFilterDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isBanned?: boolean;

  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasReferrer?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minTier?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Max(20)
  maxTier?: number;

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
  @IsEnum(UserSortField)
  sortBy?: UserSortField = UserSortField.createdAt;

  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder = SortOrder.desc;
}

// ============================================
// Ban DTOs
// ============================================

export class BanUserDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason: string;
}

export class UnbanUserDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}

// ============================================
// Balance Management DTOs
// ============================================

export class UpdateBalanceDto {
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0, { message: 'Fortune balance must be non-negative' })
  fortuneBalance?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0, { message: 'Referral balance must be non-negative' })
  referralBalance?: number;
}

export enum BalanceOperation {
  ADD = 'add',
  SUBTRACT = 'subtract',
  SET = 'set',
}

export class AdjustBalanceDto {
  @IsEnum(BalanceOperation)
  operation: BalanceOperation;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0, { message: 'Fortune amount must be non-negative' })
  fortuneAmount?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(0, { message: 'Referral amount must be non-negative' })
  referralAmount?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ============================================
// User Management DTOs
// ============================================

export class UpdateReferrerDto {
  @IsOptional()
  @IsString()
  referredById?: string | null;
}

export class UpdateFreeSpinsDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(1000, { message: 'Free spins cannot exceed 1000' })
  freeSpinsRemaining: number;
}

// ============================================
// Machine Management DTOs
// ============================================

export class AddMachineDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10, { message: 'Tier must be between 1 and 10' })
  tier: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(7, { message: 'Reinvest round must be between 1 and 7' })
  reinvestRound?: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class DeleteMachineDto {
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

export class ExtendMachineLifespanDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(365, { message: 'Cannot extend more than 365 days at once' })
  daysToAdd: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}

// ============================================
// Response Types
// ============================================

export interface UserListItemResponse {
  id: string;
  telegramId: string | null;
  email: string | null;
  web3Address: string | null;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fortuneBalance: number;
  referralBalance: number;
  maxTierReached: number;
  maxTierUnlocked: number;
  currentTaxRate: number;
  isBanned: boolean;
  bannedAt: string | null;
  referralCode: string;
  hasReferrer: boolean;
  referralsCount: number;
  machinesCount: number;
  createdAt: string;
}

export interface MachineItemResponse {
  id: string;
  tier: number;
  purchasePrice: number;
  totalYield: number;
  profitAmount: number;
  lifespanDays: number;
  startedAt: string;
  expiresAt: string;
  ratePerSecond: number;
  accumulatedIncome: number;
  lastCalculatedAt: string;
  profitPaidOut: number;
  principalPaidOut: number;
  reinvestRound: number;
  profitReductionRate: number;
  coinBoxLevel: number;
  coinBoxCapacity: number;
  coinBoxCurrent: number;
  fortuneGambleLevel: number;
  autoCollectEnabled: boolean;
  status: string;
  createdAt: string;
}

export interface UserDetailResponse extends UserListItemResponse {
  totalFreshDeposits: number;
  totalProfitCollected: number;
  bannedReason: string | null;
  freeSpinsRemaining: number;
  lastSpinAt: string | null;
  referrer: {
    id: string;
    username: string | null;
    telegramId: string | null;
  } | null;
  machines: MachineItemResponse[];
  stats: {
    totalDeposits: number;
    totalDepositsAmount: number;
    totalWithdrawals: number;
    totalWithdrawalsAmount: number;
    totalMachinesPurchased: number;
    activeMachines: number;
    expiredMachines: number;
    totalReferralEarnings: number;
  };
}

export interface UsersListResponse {
  users: UserListItemResponse[];
  total: number;
  limit: number;
  offset: number;
}

export interface UsersStatsResponse {
  totalUsers: number;
  activeUsers: number; // Users with at least 1 active machine
  bannedUsers: number;
  usersWithReferrer: number;
  usersByTier: Record<number, number>; // Tier -> count
}

// ============================================
// Referral Tree Types
// ============================================

export interface ReferralTreeNode {
  id: string;
  telegramId: string | null;
  email: string | null;
  web3Address: string | null;
  username: string | null;
  firstName: string | null;
  fortuneBalance: number;
  maxTierReached: number;
  isBanned: boolean;
  level: number; // 1, 2, or 3
  totalContributed: number; // Total referral bonuses from this user
  machinesCount: number;
  joinedAt: string;
  children?: ReferralTreeNode[];
}

export interface ReferralTreeResponse {
  user: {
    id: string;
    username: string | null;
    referralCode: string;
  };
  tree: ReferralTreeNode[];
  stats: {
    level1Count: number;
    level2Count: number;
    level3Count: number;
    totalEarned: number;
  };
}
