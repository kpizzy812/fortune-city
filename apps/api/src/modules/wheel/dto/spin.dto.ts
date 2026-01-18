import { IsInt, IsIn, Min, Max } from 'class-validator';

export class SpinDto {
  @IsInt()
  @IsIn([1, 5, 10, 25, 50])
  multiplier: number;
}

// Individual spin result
export interface SpinResult {
  sector: string;
  multiplier: number;
  payout: number;
  isJackpot: boolean;
}

// Response DTOs
export interface SpinResponseDto {
  success: boolean;
  spinId: string;
  spinCount: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  results: SpinResult[];
  jackpotWon: boolean;
  jackpotAmount: number;
  burnAmount: number;
  poolAmount: number;
  freeSpinsUsed: number;
  freeSpinsRemaining: number;
  newBalance: number;
  currentJackpotPool: number;
}

export interface WheelStateDto {
  jackpotPool: number;
  jackpotCap: number;
  lastWinner: {
    odlqпользователя: string | null;
    amount: number | null;
    wonAt: string | null;
  } | null;
  timesWon: number;
  totalPaidOut: number;
  betAmount: number;
  multipliers: number[];
  freeSpinsRemaining: number;
  sectors: WheelSectorDto[];
}

export interface WheelSectorDto {
  sector: string;
  chance: number;
  multiplier: number;
}

export interface SpinHistoryItemDto {
  id: string;
  spinCount: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  jackpotWon: boolean;
  jackpotAmount: number;
  createdAt: string;
}

export interface SpinHistoryDto {
  items: SpinHistoryItemDto[];
  total: number;
  page: number;
  limit: number;
}
