import { IsInt, Min, Max, IsOptional, IsString } from 'class-validator';

export class CreateMachineDto {
  @IsInt()
  @Min(1)
  @Max(10)
  tier: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  reinvestRound?: number;
}

export class MachineIdDto {
  @IsString()
  id: string;
}

export class MachineResponseDto {
  id: string;
  userId: string;
  tier: number;
  purchasePrice: string;
  totalYield: string;
  profitAmount: string;
  lifespanDays: number;
  startedAt: Date;
  expiresAt: Date;
  ratePerSecond: string;
  accumulatedIncome: string;
  coinBoxLevel: number;
  coinBoxCapacity: string;
  coinBoxCurrent: string;
  reinvestRound: number;
  profitReductionRate: string;
  autoCollectEnabled: boolean;
  autoCollectPurchasedAt: Date | null;
  overclockMultiplier: string;
  status: string;
  createdAt: Date;
  tierInfo: {
    name: string;
    emoji: string;
    imageUrl: string;
    yieldPercent: number;
  };
}

export class MachineIncomeDto {
  machineId: string;
  accumulated: number;
  ratePerSecond: number;
  coinBoxCapacity: number;
  coinBoxCurrent: number;
  isFull: boolean;
  secondsUntilFull: number;
  isExpired: boolean;
  canCollect: boolean;
  // Payout tracking
  profitPaidOut: number;
  principalPaidOut: number;
  profitRemaining: number;
  principalRemaining: number;
  currentProfit: number;
  currentPrincipal: number;
  isBreakevenReached: boolean;
}

export class CollectCoinsResponseDto {
  collected: number;
  machine: MachineResponseDto;
  fameEarned: number;
  overclockApplied: boolean;
  overclockMultiplier: number;
  baseAmount: number;
}

export class TierInfoDto {
  tier: number;
  name: string;
  emoji: string;
  imageUrl: string;
  price: number;
  lifespanDays: number;
  yieldPercent: number;
  profit: number;
  dailyRate: number;
}

export class SellMachineEarlyResponseDto {
  machine: MachineResponseDto;
  profitReturned: number;
  principalReturned: number;
  totalReturned: number;
  commission: number;
  commissionRate: number;
  newBalance: number;
}
