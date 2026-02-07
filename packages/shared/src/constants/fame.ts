// ============== FAME SYSTEM CONSTANTS ==============
// Fame (⚡) — progression resource earned through activity, spent on unlocks/boosts.
// Values from docs/fame-system.md

// --- Passive Fame from active machines (⚡/hour) ---
// Increased to compensate for shorter cycles (v2: 3-14 days)
export const FAME_PER_HOUR: Record<number, number> = {
  1: 3,
  2: 5,
  3: 8,
  4: 12,
  5: 18,
  6: 28,
  7: 42,
  8: 65,
  9: 100,
  10: 150,
};

// --- Manual collect bonus ---
export const FAME_PER_MANUAL_COLLECT = 10;

// --- Daily login ---
export const FAME_DAILY_LOGIN = 15;
export const FAME_STREAK_BONUS = 2; // +2⚡ per consecutive day
export const FAME_STREAK_CAP = 20; // max streak bonus

// --- Machine purchase Fame ---
export const FAME_PURCHASE_BY_TIER: Record<number, number> = {
  1: 20,
  2: 30,
  3: 50,
  4: 80,
  5: 120,
  6: 200,
  7: 350,
  8: 550,
  9: 800,
  10: 1200,
};
export const FAME_UPGRADE_MULTIPLIER = 2; // x2 if first time buying this tier

// --- Tier unlock costs (spend Fame to unlock next tier) ---
export const FAME_UNLOCK_COST_BY_TIER: Record<number, number> = {
  2: 250,
  3: 500,
  4: 1000,
  5: 2000,
  6: 4000,
  7: 7500,
  8: 14000,
  9: 26000,
  10: 45000,
};

// --- Overclock (income boost for next collect) ---
export const OVERCLOCK_LEVELS = [1.2, 1.5, 2.0] as const;
export type OverclockLevel = (typeof OVERCLOCK_LEVELS)[number];

// $ prices per tier per overclock level (v2: ~5%/12%/30% of gross profit)
export const OVERCLOCK_FORTUNE_PRICES: Record<number, Record<string, number>> = {
  1:  { '1.2': 0.25, '1.5': 0.75,  '2': 1.5 },
  2:  { '1.2': 0.75, '1.5': 2.5,   '2': 5 },
  3:  { '1.2': 2,    '1.5': 6,     '2': 15 },
  4:  { '1.2': 5,    '1.5': 15,    '2': 40 },
  5:  { '1.2': 14,   '1.5': 40,    '2': 100 },
  6:  { '1.2': 40,   '1.5': 125,   '2': 300 },
  7:  { '1.2': 130,  '1.5': 400,   '2': 900 },
  8:  { '1.2': 400,  '1.5': 1200,  '2': 2800 },
  9:  { '1.2': 1250, '1.5': 3750,  '2': 9000 },
  10: { '1.2': 3500, '1.5': 10000, '2': 25000 },
};

// Fame prices per tier per overclock level (v2: ~5h/12h/25h of passive farming)
export const OVERCLOCK_FAME_PRICES: Record<number, Record<string, number>> = {
  1:  { '1.2': 15,  '1.5': 35,   '2': 80 },
  2:  { '1.2': 25,  '1.5': 60,   '2': 140 },
  3:  { '1.2': 40,  '1.5': 100,  '2': 240 },
  4:  { '1.2': 60,  '1.5': 150,  '2': 350 },
  5:  { '1.2': 90,  '1.5': 220,  '2': 540 },
  6:  { '1.2': 140, '1.5': 340,  '2': 840 },
  7:  { '1.2': 210, '1.5': 500,  '2': 1250 },
  8:  { '1.2': 320, '1.5': 780,  '2': 1950 },
  9:  { '1.2': 500, '1.5': 1200, '2': 3000 },
  10: { '1.2': 750, '1.5': 1800, '2': 4500 },
};

export function getOverclockFortuneCost(tier: number, level: number): number | null {
  const key = level === 2.0 ? '2' : String(level);
  return OVERCLOCK_FORTUNE_PRICES[tier]?.[key] ?? null;
}

export function getOverclockFameCost(tier: number, level: number): number | null {
  const key = level === 2.0 ? '2' : String(level);
  return OVERCLOCK_FAME_PRICES[tier]?.[key] ?? null;
}

// --- Helpers ---

export function getFamePerHour(tier: number): number {
  return FAME_PER_HOUR[tier] ?? 0;
}

export function calculateDailyLoginFame(streak: number): number {
  const streakBonus = Math.min(streak * FAME_STREAK_BONUS, FAME_STREAK_CAP);
  return FAME_DAILY_LOGIN + streakBonus;
}

export function getFamePurchaseAmount(
  tier: number,
  isUpgrade: boolean,
): number {
  const base = FAME_PURCHASE_BY_TIER[tier] ?? 0;
  return isUpgrade ? base * FAME_UPGRADE_MULTIPLIER : base;
}

export function getFameUnlockCost(tier: number): number | null {
  return FAME_UNLOCK_COST_BY_TIER[tier] ?? null;
}

// Calculate collector hire cost in Fame for a given tier
// Formula: COLLECTOR_HIRE_FAME_HOURS × FAME_PER_HOUR[tier]
export function calculateCollectorHireFameCost(tier: number): number {
  // Import-free: uses FAME_PER_HOUR from this file + constant from tiers
  const fameRate = FAME_PER_HOUR[tier] ?? 0;
  return fameRate * 5; // 5 hours of passive farming (COLLECTOR_HIRE_FAME_HOURS)
}
