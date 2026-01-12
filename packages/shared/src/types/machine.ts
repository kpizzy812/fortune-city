export type MachineStatus = 'active' | 'expired' | 'sold_early';

export interface Machine {
  id: string;
  userId: string;
  tier: number;

  // Financials
  purchasePrice: number;
  totalYield: number;      // Total expected yield (price * yieldPercent)
  profitAmount: number;    // Just the profit portion

  // Lifecycle
  lifespanDays: number;
  startedAt: Date;
  expiresAt: Date;

  // Income tracking
  ratePerSecond: number;
  accumulatedIncome: number;
  lastCalculatedAt: Date;

  // Payout tracking (profit first, then principal)
  profitPaidOut: number;
  principalPaidOut: number;

  // Reinvest
  reinvestRound: number;
  profitReductionRate: number;

  // Coin box
  coinBoxLevel: number;
  coinBoxCapacity: number;
  coinBoxCurrent: number;

  status: MachineStatus;

  createdAt: Date;
  updatedAt: Date;
}

export interface MachineCreateInput {
  tier: number;
  reinvestRound?: number;
}

export interface MachineIncomeResponse {
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

export interface UpgradeCoinBoxResult {
  machine: Machine;
  cost: number;
  newLevel: number;
  newCapacity: number;
  user: {
    fortuneBalance: string;
  };
}

export interface CoinBoxInfo {
  currentLevel: number;
  currentCapacityHours: number;
  canUpgrade: boolean;
  nextLevel: number | null;
  nextCapacityHours: number | null;
  upgradeCost: number | null;
}
