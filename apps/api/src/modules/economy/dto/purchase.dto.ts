import { IsInt, Min, Max, IsOptional } from 'class-validator';

export class PurchaseMachineDto {
  @IsInt()
  @Min(1)
  @Max(10)
  tier: number;

  @IsOptional()
  @IsInt()
  @Min(1)
  reinvestRound?: number;
}

export class PurchaseMachineResponseDto {
  machine: {
    id: string;
    tier: number;
    purchasePrice: string;
    totalYield: string;
    profitAmount: string;
    lifespanDays: number;
    startedAt: Date;
    expiresAt: Date;
    status: string;
    tierInfo: {
      name: string;
      emoji: string;
      imageUrl: string;
      yieldPercent: number;
    };
  };
  transaction: {
    id: string;
    type: string;
    amount: string;
    status: string;
    createdAt: Date;
  };
  user: {
    id: string;
    fortuneBalance: string;
    maxTierReached: number;
    maxTierUnlocked: number;
    currentTaxRate: string;
  };
}

export class CanAffordResponseDto {
  canAfford: boolean;
  price: number;
  currentBalance: number;
  shortfall: number;
  tierLocked: boolean;
  hasActiveMachine: boolean;
}

export class TransactionResponseDto {
  id: string;
  type: string;
  amount: string;
  currency: string;
  taxAmount: string;
  taxRate: string;
  netAmount: string;
  status: string;
  createdAt: Date;
  machineId?: string;
}

export class TransactionStatsDto {
  totalDeposits: number;
  totalWithdrawals: number;
  totalMachinesPurchased: number;
  totalEarnings: number;
}
