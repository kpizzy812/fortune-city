'use client';

import { motion } from 'framer-motion';
import type { TierInfo, CanAffordResponse } from '@/types';
import { TierCard } from './TierCard';

interface TierGridProps {
  tiers: TierInfo[];
  affordability: Record<number, CanAffordResponse>;
  maxTierReached: number;
  onBuyTier: (tier: number) => void;
  isPurchasing: boolean;
  isLoading?: boolean;
}

export function TierGrid({
  tiers,
  affordability,
  maxTierReached,
  onBuyTier,
  isPurchasing,
  isLoading = false,
}: TierGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent mb-4" />
        <p className="text-[#b0b0b0]">Loading machines...</p>
      </div>
    );
  }

  // Empty state (should never happen)
  if (tiers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <p className="text-[#b0b0b0]">No machines available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {tiers.map((tier, index) => (
        <motion.div
          key={tier.tier}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.05 }}
        >
          <TierCard
            tier={tier}
            canAfford={affordability[tier.tier] || null}
            maxTierReached={maxTierReached}
            onBuy={() => onBuyTier(tier.tier)}
            isPurchasing={isPurchasing}
          />
        </motion.div>
      ))}
    </div>
  );
}
