export const MACHINE_TIERS = [
  {
    tier: 1,
    name: 'RUSTY LEVER',
    emoji: '🟤',
    price: 10,
    lifespanDays: 7,
    yieldPercent: 135,
  },
  {
    tier: 2,
    name: 'LUCKY CHERRY',
    emoji: '🟠',
    price: 30,
    lifespanDays: 10,
    yieldPercent: 150,
  },
  {
    tier: 3,
    name: 'GOLDEN 7s',
    emoji: '🟡',
    price: 80,
    lifespanDays: 14,
    yieldPercent: 170,
  },
  {
    tier: 4,
    name: 'NEON NIGHTS',
    emoji: '🟢',
    price: 220,
    lifespanDays: 18,
    yieldPercent: 190,
  },
  {
    tier: 5,
    name: 'DIAMOND DASH',
    emoji: '🔵',
    price: 600,
    lifespanDays: 22,
    yieldPercent: 210,
  },
  {
    tier: 6,
    name: 'VEGAS QUEEN',
    emoji: '🟣',
    price: 1800,
    lifespanDays: 27,
    yieldPercent: 235,
  },
  {
    tier: 7,
    name: 'PLATINUM RUSH',
    emoji: '⚪',
    price: 5500,
    lifespanDays: 32,
    yieldPercent: 260,
  },
  {
    tier: 8,
    name: 'HIGH ROLLER',
    emoji: '🔴',
    price: 18000,
    lifespanDays: 37,
    yieldPercent: 285,
  },
  {
    tier: 9,
    name: 'JACKPOT EMPEROR',
    emoji: '⚫',
    price: 60000,
    lifespanDays: 42,
    yieldPercent: 310,
  },
  {
    tier: 10,
    name: 'FORTUNE KING',
    emoji: '👑',
    price: 200000,
    lifespanDays: 48,
    yieldPercent: 340,
  },
] as const;

export type MachineTier = (typeof MACHINE_TIERS)[number];

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

// Coin box levels
export const COIN_BOX_LEVELS = [
  { level: 1, capacityHours: 8, cost: 0 },
  { level: 2, capacityHours: 16, cost: 50 },
  { level: 3, capacityHours: 24, cost: 150 },
  { level: 4, capacityHours: 48, cost: 400 },
  { level: 5, capacityHours: 72, cost: 1000 },
] as const;
