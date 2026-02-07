import { IsInt, Min, Max } from 'class-validator';

export class UnlockTierDto {
  @IsInt()
  @Min(2)
  @Max(10)
  tier: number;
}

export interface FameBalanceResponse {
  fame: number;
  totalFameEarned: number;
  loginStreak: number;
  lastLoginDate: string | null;
  maxTierUnlocked: number;
}

export interface DailyLoginResponse {
  earned: number;
  streak: number;
  totalFame: number;
}

export interface UnlockTierResponse {
  tier: number;
  cost: number;
  maxTierUnlocked: number;
  remainingFame: number;
}

export interface FameHistoryItem {
  id: string;
  amount: number;
  balanceAfter: number;
  source: string;
  description: string | null;
  machineId: string | null;
  createdAt: string;
}

export interface FameHistoryResponse {
  items: FameHistoryItem[];
  total: number;
  page: number;
  limit: number;
}
