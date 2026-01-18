import { IsInt, Min, Max } from 'class-validator';

export class PurchaseMachineDto {
  @IsInt()
  @Min(1)
  @Max(10)
  tier: number;
  // reinvestRound is calculated automatically on the backend
  // based on user's purchase history for this tier
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
  fortuneBalance: number;
  referralBalance: number;
  shortfall: number;
  tierLocked: boolean;
  hasActiveMachine: boolean;
  // Reinvest penalty info
  isUpgrade: boolean;
  nextReinvestRound: number;
  currentProfitReduction: number;
  nextProfitReduction: number;
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
