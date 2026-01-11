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

// Coin box levels (cost is percentage of machine price)
export const COIN_BOX_LEVELS = [
  { level: 1, capacityHours: 2, costPercent: 0 },    // Free
  { level: 2, capacityHours: 6, costPercent: 5 },    // 5% of machine price
  { level: 3, capacityHours: 12, costPercent: 10 },  // 10%
  { level: 4, capacityHours: 24, costPercent: 20 },  // 20%
  { level: 5, capacityHours: 48, costPercent: 35 },  // 35%
] as const;
