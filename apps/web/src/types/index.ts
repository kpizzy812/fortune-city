// ============================================
// Tier Types
// ============================================

export interface TierInfo {
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

// ============================================
// Machine Types
// ============================================

export type MachineStatus = 'active' | 'expired' | 'sold_early';

export interface MachineTierInfo {
  name: string;
  emoji: string;
  imageUrl: string;
  yieldPercent: number;
}

export interface Machine {
  id: string;
  userId: string;
  tier: number;
  purchasePrice: string;
  totalYield: string;
  profitAmount: string;
  lifespanDays: number;
  startedAt: string;
  expiresAt: string;
  ratePerSecond: string;
  accumulatedIncome: string;
  lastCalculatedAt: string;
  profitPaidOut: string;
  principalPaidOut: string;
  coinBoxLevel: number;
  coinBoxCapacity: string;
  coinBoxCurrent: string;
  reinvestRound: number;
  profitReductionRate: string;
  fortuneGambleLevel: number;
  autoCollectEnabled: boolean;
  autoCollectPurchasedAt: string | null;
  status: MachineStatus;
  createdAt: string;
  updatedAt: string;
  tierInfo: MachineTierInfo;
}

export interface MachineIncome {
  machineId: string;
  accumulated: number;
  ratePerSecond: number;
  coinBoxCapacity: number;
  coinBoxCurrent: number;
  isFull: boolean;
  secondsUntilFull: number;
}

export interface CollectResult {
  collected: number;
  newBalance: number;
  machine: Machine;
}

// ============================================
// Fortune's Gamble (Risky Collect) Types
// ============================================

export interface RiskyCollectResult {
  won: boolean;
  originalAmount: number;
  finalAmount: number;
  winChance: number;
  multiplier: number;
  machine: Machine;
  newBalance: number;
}

export interface GambleInfo {
  currentLevel: number;
  currentWinChance: number;
  currentEV: number;
  canUpgrade: boolean;
  nextLevel: number | null;
  nextWinChance: number | null;
  nextEV: number | null;
  upgradeCost: number | null;
}

export interface UpgradeGambleResult {
  machine: Machine;
  cost: number;
  newLevel: number;
  newWinChance: number;
  user: {
    fortuneBalance: string;
  };
}

// ============================================
// Coin Box Upgrade Types
// ============================================

export interface CoinBoxInfo {
  currentLevel: number;
  currentCapacityHours: number;
  canUpgrade: boolean;
  nextLevel: number | null;
  nextCapacityHours: number | null;
  upgradeCost: number | null;
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

// ============================================
// Auto Collect Types
// ============================================

export interface AutoCollectInfo {
  enabled: boolean;
  cost: number;
  purchasedAt: string | null;
  canPurchase: boolean;
  alreadyPurchased: boolean;
}

export interface PurchaseAutoCollectResult {
  machine: Machine;
  cost: number;
  user: {
    fortuneBalance: string;
  };
  newBalance: number;
}

// ============================================
// Economy Types
// ============================================

export interface CanAffordResponse {
  canAfford: boolean;
  price: number;
  currentBalance: number;
  shortfall: number;
  tierLocked: boolean;
  hasActiveMachine: boolean;
}

export interface PurchaseResult {
  machine: Machine;
  transaction: {
    id: string;
    type: string;
    amount: string;
    status: string;
    createdAt: string;
  };
  user: {
    id: string;
    fortuneBalance: string;
    maxTierReached: number;
    currentTaxRate: string;
  };
}

// ============================================
// Transaction Types
// ============================================

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'machine_purchase'
  | 'machine_income'
  | 'machine_income_risky'
  | 'machine_early_sell'
  | 'referral_bonus'
  | 'wheel_prize'
  | 'upgrade_purchase';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'cancelled';

export interface Transaction {
  id: string;
  userId: string;
  machineId?: string;
  type: TransactionType;
  amount: string;
  currency: 'FORTUNE' | 'USDT';
  taxAmount: string;
  taxRate: string;
  netAmount: string;
  status: TransactionStatus;
  createdAt: string;
}

// ============================================
// User Types (extended from auth)
// ============================================

export interface UserData {
  id: string;
  telegramId: string;
  username: string | null;
  firstName: string | null;
  lastName: string | null;
  fortuneBalance: string;
  maxTierReached: number;
  currentTaxRate: string;
}
