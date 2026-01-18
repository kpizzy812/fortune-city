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

export type MachineStatus = 'active' | 'expired' | 'sold_early' | 'sold_auction' | 'sold_pawnshop' | 'listed_auction';

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
  fortuneBalance: number;
  referralBalance: number;
  shortfall: number;
  tierLocked: boolean;
  hasActiveMachine: boolean;
  // Reinvest penalty info
  isUpgrade: boolean;
  nextReinvestRound: number;
  currentProfitReduction: number; // % reduction on current machine (0-85)
  nextProfitReduction: number; // % reduction if buy now (0-85)
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
// Sale Types (Auction & Pawnshop)
// ============================================

export interface AuctionInfo {
  canList: boolean;
  reason?: string;
  wearPercent: number;
  commissionRate: number;
  expectedPayout: number;
  tierPrice: number;
  queuePosition?: number;
  queueLength: number;
}

export interface PawnshopInfo {
  canSell: boolean;
  reason?: string;
  tierPrice: number;
  collectedProfit: number;
  coinBoxCurrent: number;
  commissionRate: number;
  commissionAmount: number;
  expectedPayout: number;
  totalOnHand: number;
}

export interface SaleOptions {
  auction: AuctionInfo;
  pawnshop: PawnshopInfo;
  recommendation: 'auction' | 'pawnshop' | 'wait';
  recommendationReasonCode: string;
  recommendationReasonParams: Record<string, string | number>;
}

export interface ListOnAuctionResult {
  listing: {
    id: string;
    machineId: string;
    tier: number;
    wearPercent: number;
    commissionRate: number;
    expectedPayout: number;
    status: string;
    createdAt: string;
  };
  machine: Machine;
}

export interface CancelAuctionResult {
  listing: {
    id: string;
    machineId: string;
    status: string;
  };
  machine: Machine;
}

export interface PawnshopSaleResult {
  machine: Machine;
  tierPrice: number;
  collectedProfit: number;
  commissionRate: number;
  commissionAmount: number;
  payout: number;
  totalOnHand: number;
  user: {
    fortuneBalance: string;
  };
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

// ============================================
// Fortune Wheel Types
// ============================================

export type WheelMultiplier = 1 | 5 | 10 | 25 | 50;

export interface WheelSector {
  sector: string;
  chance: number;
  multiplier: number;
}

export interface SpinResult {
  sector: string;
  multiplier: number;
  payout: number;
  isJackpot: boolean;
}

export interface SpinResponse {
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

export interface WheelState {
  jackpotPool: number;
  jackpotCap: number;
  lastWinner: {
    userId: string;
    amount: number | null;
    wonAt: string | null;
  } | null;
  timesWon: number;
  totalPaidOut: number;
  betAmount: number;
  multipliers: number[];
  freeSpinsRemaining: number;
  sectors: WheelSector[];
}

export interface SpinHistoryItem {
  id: string;
  spinCount: number;
  totalBet: number;
  totalPayout: number;
  netResult: number;
  jackpotWon: boolean;
  jackpotAmount: number;
  createdAt: string;
}

export interface SpinHistory {
  items: SpinHistoryItem[];
  total: number;
  page: number;
  limit: number;
}

export interface JackpotInfo {
  currentPool: number;
  lastWinner: string | null;
  lastAmount: number | null;
  timesWon: number;
}
