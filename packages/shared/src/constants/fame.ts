// ============== FAME SYSTEM CONSTANTS ==============
// Fame (⚡) — progression resource earned through activity, spent on unlocks/boosts.
// Values from docs/fame-system.md

// --- Passive Fame from active machines (⚡/hour) ---
export const FAME_PER_HOUR: Record<number, number> = {
  1: 2,
  2: 3,
  3: 5,
  4: 8,
  5: 12,
  6: 18,
  7: 28,
  8: 42,
  9: 65,
  10: 100,
};

// --- Manual collect bonus ---
export const FAME_PER_MANUAL_COLLECT = 10;

// --- Daily login ---
export const FAME_DAILY_LOGIN = 15;
export const FAME_STREAK_BONUS = 2; // +2⚡ per consecutive day
export const FAME_STREAK_CAP = 20; // max streak bonus

// --- Machine purchase Fame ---
export const FAME_PURCHASE_BY_TIER: Record<number, number> = {
  1: 15,
  2: 25,
  3: 40,
  4: 60,
  5: 100,
  6: 150,
  7: 250,
  8: 400,
  9: 600,
  10: 1000,
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
