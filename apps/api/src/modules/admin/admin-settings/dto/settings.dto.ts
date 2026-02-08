import {
  IsNumber,
  IsOptional,
  IsObject,
  IsBoolean,
  IsDateString,
  Min,
  Max,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

// ============== Request DTOs ==============

export class UpdateGeneralSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxGlobalTier?: number;
}

export class UpdateDepositSettingsDto {
  @IsOptional()
  @IsObject()
  minDepositAmounts?: Record<string, number>; // {"SOL": 0.01, "USDT_SOL": 1, "FORTUNE": 10}

  @IsOptional()
  @IsNumber()
  @Min(0)
  minWithdrawalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  walletConnectFeeSol?: number;
}

export class UpdateEconomySettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  pawnshopCommission?: number;

  @IsOptional()
  @IsObject()
  taxRatesByTier?: Record<string, number>; // {"1": 0.5, "2": 0.5, ...}

  @IsOptional()
  @IsObject()
  referralRates?: Record<string, number>; // {"1": 0.05, "2": 0.03, "3": 0.01}

  @IsOptional()
  @IsObject()
  reinvestReduction?: Record<string, number>; // {"1": 0, "2": 0.05, ...}
}

export class UpdateCommissionSettingsDto {
  @IsOptional()
  @IsObject()
  auctionCommissions?: Record<string, number>; // {"20": 0.10, "40": 0.20, ...}

  @IsOptional()
  @IsObject()
  earlySellCommissions?: Record<string, number>; // {"20": 0.20, "40": 0.35, ...}
}

export class GambleLevelDto {
  @IsNumber()
  level: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  winChance: number;

  @IsNumber()
  @Min(0)
  costPercent: number;
}

export class UpdateGambleSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  gambleWinMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gambleLoseMultiplier?: number;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => GambleLevelDto)
  gambleLevels?: GambleLevelDto[];
}

// Unified update for all settings at once
export class UpdateAllSettingsDto {
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  maxGlobalTier?: number;

  @IsOptional()
  @IsObject()
  minDepositAmounts?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  minWithdrawalAmount?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  walletConnectFeeSol?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  pawnshopCommission?: number;

  @IsOptional()
  @IsObject()
  taxRatesByTier?: Record<string, number>;

  @IsOptional()
  @IsObject()
  referralRates?: Record<string, number>;

  @IsOptional()
  @IsObject()
  reinvestReduction?: Record<string, number>;

  @IsOptional()
  @IsObject()
  auctionCommissions?: Record<string, number>;

  @IsOptional()
  @IsObject()
  earlySellCommissions?: Record<string, number>;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gambleWinMultiplier?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  gambleLoseMultiplier?: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => GambleLevelDto)
  gambleLevels?: GambleLevelDto[];

  // Coin Box - fixed capacity for all machines
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(168) // max 7 days
  coinBoxCapacityHours?: number;

  // Collector (Auto Collect)
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  collectorHirePercent?: number; // 10% of gross profit (default)

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  collectorSalaryPercent?: number; // 5% default

  // Prelaunch
  @IsOptional()
  @IsBoolean()
  isPrelaunch?: boolean;

  @IsOptional()
  @IsDateString()
  prelaunchEndsAt?: string | null;
}

// ============== Response DTOs ==============

export interface GambleLevel {
  level: number;
  winChance: number;
  costPercent: number;
}

export interface SettingsResponse {
  id: string;
  maxGlobalTier: number;
  minDepositAmounts: Record<string, number>;
  minWithdrawalAmount: number;
  walletConnectFeeSol: number;
  pawnshopCommission: number;
  taxRatesByTier: Record<string, number>;
  referralRates: Record<string, number>;
  reinvestReduction: Record<string, number>;
  auctionCommissions: Record<string, number>;
  earlySellCommissions: Record<string, number>;
  gambleWinMultiplier: number;
  gambleLoseMultiplier: number;
  gambleLevels: GambleLevel[];
  // Coin Box & Collector
  coinBoxCapacityHours: number;
  collectorHirePercent: number;
  collectorSalaryPercent: number;
  // Prelaunch
  isPrelaunch: boolean;
  prelaunchEndsAt: string | null;
  createdAt: string;
  updatedAt: string;
}
