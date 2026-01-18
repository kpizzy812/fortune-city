export const MACHINE_TIERS = [
  {
    tier: 1,
    name: 'RUSTY LEVER',
    emoji: '🟤',
    price: 10,
    lifespanDays: 7,
    yieldPercent: 135,
    imageUrl: '/machines/tier-1.png',
  },
  {
    tier: 2,
    name: 'LUCKY CHERRY',
    emoji: '🟠',
    price: 30,
    lifespanDays: 10,
    yieldPercent: 150,
    imageUrl: '/machines/tier-2.png',
  },
  {
    tier: 3,
    name: 'GOLDEN 7s',
    emoji: '🟡',
    price: 80,
    lifespanDays: 14,
    yieldPercent: 170,
    imageUrl: '/machines/tier-3.png',
  },
  {
    tier: 4,
    name: 'NEON NIGHTS',
    emoji: '🟢',
    price: 220,
    lifespanDays: 18,
    yieldPercent: 190,
    imageUrl: '/machines/tier-4.png',
  },
  {
    tier: 5,
    name: 'DIAMOND DASH',
    emoji: '🔵',
    price: 600,
    lifespanDays: 22,
    yieldPercent: 210,
    imageUrl: '/machines/tier-5.png',
  },
  {
    tier: 6,
    name: 'VEGAS QUEEN',
    emoji: '🟣',
    price: 1800,
    lifespanDays: 27,
    yieldPercent: 235,
    imageUrl: '/machines/tier-6.png',
  },
  {
    tier: 7,
    name: 'PLATINUM RUSH',
    emoji: '⚪',
    price: 5500,
    lifespanDays: 32,
    yieldPercent: 260,
    imageUrl: '/machines/tier-7.png',
  },
  {
    tier: 8,
    name: 'HIGH ROLLER',
    emoji: '🔴',
    price: 18000,
    lifespanDays: 37,
    yieldPercent: 285,
    imageUrl: '/machines/tier-8.png',
  },
  {
    tier: 9,
    name: 'JACKPOT EMPEROR',
    emoji: '⚫',
    price: 60000,
    lifespanDays: 42,
    yieldPercent: 310,
    imageUrl: '/machines/tier-9.png',
  },
  {
    tier: 10,
    name: 'FORTUNE KING',
    emoji: '👑',
    price: 200000,
    lifespanDays: 48,
    yieldPercent: 340,
    imageUrl: '/machines/tier-10.png',
  },
] as const;

export type MachineTier = (typeof MACHINE_TIERS)[number];

export function getTierConfig(tier: number): MachineTier | undefined {
  return MACHINE_TIERS.find((t) => t.tier === tier);
}

export function getTierConfigOrThrow(tier: number): MachineTier {
  const config = getTierConfig(tier);
  if (!config) {
    throw new Error(`Invalid tier: ${tier}. Must be between 1 and 10`);
  }
  return config;
}

// Tax rates by max tier reached
export const TAX_RATES_BY_TIER: Record<number, number> = {
  1: 0.5,   // 50%
  2: 0.5,
  3: 0.4,   // 40%
  4: 0.4,
  5: 0.3,   // 30%
  6: 0.3,
  7: 0.2,   // 20%
  8: 0.2,
  9: 0.2,
  10: 0.1,  // 10%
};

// Reinvest profit reduction
export const REINVEST_REDUCTION: Record<number, number> = {
  1: 0,      // 0%
  2: 0.05,   // -5%
  3: 0.10,   // -10%
  4: 0.15,   // -15%
  5: 0.23,   // -23%
  6: 0.33,   // -33%
  7: 0.45,   // -45%
  8: 0.58,   // -58%
  9: 0.70,   // -70%
  10: 0.80,  // -80%
  11: 0.85,  // -85% (cap)
};

// Coin box - fixed capacity for all machines (no upgrades)
export const COIN_BOX_CAPACITY_HOURS = 12;

// Coin Box upgrade levels
export const COIN_BOX_LEVELS = [
  { level: 1, capacityHours: 2, costPercent: 0 },
  { level: 2, capacityHours: 6, costPercent: 5 },
  { level: 3, capacityHours: 12, costPercent: 10 },
  { level: 4, capacityHours: 24, costPercent: 20 },
  { level: 5, capacityHours: 48, costPercent: 35 },
] as const;

export type CoinBoxLevel = (typeof COIN_BOX_LEVELS)[number];

// Fortune's Gamble Levels (Risky Collect feature)
// Win 2x or Lose (get 0.5x) when collecting from full coin box
export const FORTUNE_GAMBLE_LEVELS = [
  { level: 0, winChance: 0.1333, costPercent: 0 },  // EV 70%, Sink 30%
  { level: 1, winChance: 0.1533, costPercent: 3 },  // EV 73%, Sink 27%
  { level: 2, winChance: 0.1733, costPercent: 6 },  // EV 76%, Sink 24%
  { level: 3, winChance: 0.1867, costPercent: 10 }, // EV 78%, Sink 22%
] as const;

export const GAMBLE_WIN_MULTIPLIER = 2.0;
export const GAMBLE_LOSE_MULTIPLIER = 0.5;

// Collector (Auto Collect) - автосбор при заполнении Coin Box
// Механика: $5 за найм + 5% от каждого сбора (зарплата)
export const COLLECTOR_HIRE_COST = 5; // Fixed $5 hire cost
export const COLLECTOR_SALARY_PERCENT = 5; // 5% of each collection

export type FortuneGambleLevel = (typeof FORTUNE_GAMBLE_LEVELS)[number];

export function getGambleLevelConfig(level: number): FortuneGambleLevel {
  return FORTUNE_GAMBLE_LEVELS[Math.min(level, FORTUNE_GAMBLE_LEVELS.length - 1)];
}

export function calculateGambleEV(level: number): number {
  const config = getGambleLevelConfig(level);
  return (config.winChance * GAMBLE_WIN_MULTIPLIER) +
         ((1 - config.winChance) * GAMBLE_LOSE_MULTIPLIER);
}

// Referral system rates by level (3 levels deep)
export const REFERRAL_RATES: Record<number, number> = {
  1: 0.05, // 5% from line 1
  2: 0.03, // 3% from line 2
  3: 0.01, // 1% from line 3
};

export const REFERRAL_MAX_LEVELS = 3;

// Early sell commission based on progress to breakeven
// Breakeven is at 67% of lifecycle for all tiers
export function calculateEarlySellCommission(
  profitPaidOut: number,
  profitAmount: number,
): number {
  if (profitAmount === 0) {
    return 1.0; // 100% commission if no profit (shouldn't happen)
  }

  // Progress to breakeven (0-100)
  const progressPercent = (profitPaidOut / profitAmount) * 100;

  // Commission tiers from math.md
  if (progressPercent < 20) return 0.20;  // 20% commission
  if (progressPercent < 40) return 0.35;  // 35%
  if (progressPercent < 60) return 0.55;  // 55%
  if (progressPercent < 80) return 0.75;  // 75%
  if (progressPercent < 100) return 0.90; // 90%
  return 1.0; // 100% - после BE тело невыводное
}

// ===== AUCTION (P2P Sale) =====
// Commission based on machine wear (time elapsed / lifespan)
export function calculateAuctionCommission(wearPercent: number): number {
  // Commission tiers based on wear
  if (wearPercent < 20) return 0.10;  // 10% commission
  if (wearPercent < 40) return 0.20;  // 20%
  if (wearPercent < 60) return 0.35;  // 35%
  if (wearPercent < 80) return 0.55;  // 55%
  return 0.75; // 75% for 80-100% wear
}

// Calculate machine wear percentage
export function calculateMachineWear(
  startedAt: Date,
  expiresAt: Date,
  now: Date = new Date(),
): number {
  const totalLifespan = expiresAt.getTime() - startedAt.getTime();
  const elapsed = Math.min(now.getTime() - startedAt.getTime(), totalLifespan);
  return Math.max(0, Math.min(100, (elapsed / totalLifespan) * 100));
}

// ===== PAWNSHOP (Instant Sale to System) =====
// Pawnshop takes all collected profit + 10% commission
export const PAWNSHOP_COMMISSION_RATE = 0.10; // 10%

// Calculate pawnshop payout
// Formula: P × 0.9 - collected_profit
// Result: player always exits with -10% of investment
export function calculatePawnshopPayout(
  machinePrice: number,
  collectedProfit: number,
): { payout: number; isAvailable: boolean } {
  const maxPayout = machinePrice * (1 - PAWNSHOP_COMMISSION_RATE);
  const payout = maxPayout - collectedProfit;

  // Pawnshop is unavailable if payout would be negative (after BE)
  return {
    payout: Math.max(0, payout),
    isAvailable: payout > 0,
  };
}
