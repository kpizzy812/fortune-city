// ============== FAME SYSTEM CONSTANTS (v3) ==============
// Fame (⚡) — progression resource earned through activity.
// v3: auto-unlock tiers by totalFameEarned, overclock/extend removed.
// See docs/economy-v3-redesign.md

// --- Passive Fame from active machines (⚡/hour) ---
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

// --- Auto-unlock thresholds (cumulative totalFameEarned) ---
// Tiers unlock automatically when user's totalFameEarned reaches threshold.
// No fame is SPENT — this is purely based on lifetime earned fame.
export const FAME_AUTO_UNLOCK_THRESHOLDS: Record<number, number> = {
  1: 0, // always available
  2: 250,
  3: 750,
  4: 1_750,
  5: 3_750,
  6: 7_750,
  7: 15_250,
  8: 29_250,
  9: 55_250,
  10: 100_250,
};

// --- Tier Unlock Purchase (instant unlock for $) ---
// Users can skip the fame grind by paying % of tier's machine price.
export const TIER_UNLOCK_FEE_PERCENT = 0.10; // 10% of tier price

// --- Speed Up (accelerate machine cycle) ---
// Reduces remaining cycle time. Yield stays the same (ratePerSecond increases).
// $ price = SPEED_UP_COST_PERCENT_PER_DAY × machine_price × days
// Fame price = SPEED_UP_FAME_HOURS_PER_DAY × FAME_PER_HOUR[tier] × days
export const SPEED_UP_COST_PERCENT_PER_DAY = 0.01; // 1% of machine price per day
export const SPEED_UP_FAME_HOURS_PER_DAY = 10; // 10h of passive fame farming per day

// --- Collector Fame pricing (v3: ×2.5 multiplier) ---
// Formula: FAME_PER_HOUR[tier] × COLLECTOR_HIRE_FAME_HOURS
export const COLLECTOR_HIRE_FAME_HOURS = 12.5; // was 5, now ×2.5

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

/** Get the totalFameEarned threshold for auto-unlocking a tier */
export function getAutoUnlockThreshold(tier: number): number {
  return FAME_AUTO_UNLOCK_THRESHOLDS[tier] ?? Infinity;
}

/** Check which tier should be unlocked for a given totalFameEarned */
export function getMaxUnlockedTierByFame(totalFameEarned: number): number {
  let maxTier = 1;
  for (let tier = 2; tier <= 10; tier++) {
    if (totalFameEarned >= (FAME_AUTO_UNLOCK_THRESHOLDS[tier] ?? Infinity)) {
      maxTier = tier;
    } else {
      break;
    }
  }
  return maxTier;
}

/** Calculate $ cost to instantly unlock a tier */
export function calculateTierUnlockFee(tierPrice: number): number {
  return tierPrice * TIER_UNLOCK_FEE_PERCENT;
}

/** Calculate Speed Up $ cost */
export function calculateSpeedUpFortuneCost(
  machinePrice: number,
  days: number,
): number {
  return machinePrice * SPEED_UP_COST_PERCENT_PER_DAY * days;
}

/** Calculate Speed Up fame cost */
export function calculateSpeedUpFameCost(
  tier: number,
  days: number,
): number {
  const fameRate = FAME_PER_HOUR[tier] ?? 0;
  return Math.ceil(fameRate * SPEED_UP_FAME_HOURS_PER_DAY * days);
}

/** Calculate collector hire cost in Fame for a given tier */
export function calculateCollectorHireFameCost(tier: number): number {
  const fameRate = FAME_PER_HOUR[tier] ?? 0;
  return Math.ceil(fameRate * COLLECTOR_HIRE_FAME_HOURS);
}
