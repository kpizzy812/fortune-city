'use client';

import { motion } from 'framer-motion';
import { Lock } from 'lucide-react';
import type { TierInfo, CanAffordResponse } from '@/types';
import { Button } from '@/components/ui/Button';

interface TierCardProps {
  tier: TierInfo;
  canAfford: CanAffordResponse | null;
  maxTierReached: number;
  onBuy: () => void;
  isPurchasing: boolean;
}

export function TierCard({
  tier,
  canAfford,
  maxTierReached,
  onBuy,
  isPurchasing,
}: TierCardProps) {
  // Tier is locked if it's more than 1 level above max reached
  const isLocked = tier.tier > maxTierReached + 1;
  const isAffordable = canAfford?.canAfford ?? false;
  const canBuy = !isLocked && isAffordable && !isPurchasing;

  // Calculate profit
  const profit = tier.price * (tier.yieldPercent / 100 - 1);
  const dailyRate = (tier.yieldPercent - 100) / tier.lifespanDays;

  return (
    <motion.div
      whileHover={!isLocked ? { scale: 1.02 } : {}}
      className={`
        bg-[#2a1a4e] rounded-xl p-4
        border transition-all duration-300
        ${
          isLocked
            ? 'border-[#6b6b6b]/30 opacity-60'
            : canBuy
              ? 'border-[#00d4ff]/50 hover:border-[#00d4ff] hover:shadow-[0_0_20px_rgba(0,212,255,0.2)]'
              : 'border-[#ff2d95]/30'
        }
      `}
    >
      <div className="flex items-start justify-between">
        {/* Left: Info */}
        <div className="flex items-center gap-3">
          <span className="text-4xl">{tier.emoji}</span>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-white text-lg">{tier.name}</h3>
              {isLocked && (
                <Lock className="w-4 h-4 text-[#6b6b6b]" />
              )}
            </div>
            <p className="text-[#b0b0b0] text-sm">Tier {tier.tier}</p>
          </div>
        </div>

        {/* Right: Price */}
        <div className="text-right">
          <p className="text-2xl font-bold text-[#ffd700]">
            ${tier.price.toLocaleString()}
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mt-4 mb-4">
        <div className="bg-[#1a0a2e] rounded-lg p-2 text-center">
          <p className="text-xs text-[#b0b0b0]">Duration</p>
          <p className="text-sm font-semibold text-white">{tier.lifespanDays}d</p>
        </div>
        <div className="bg-[#1a0a2e] rounded-lg p-2 text-center">
          <p className="text-xs text-[#b0b0b0]">Yield</p>
          <p className="text-sm font-semibold text-[#00ff88]">{tier.yieldPercent}%</p>
        </div>
        <div className="bg-[#1a0a2e] rounded-lg p-2 text-center">
          <p className="text-xs text-[#b0b0b0]">Profit</p>
          <p className="text-sm font-semibold text-[#ffd700]">${profit.toFixed(0)}</p>
        </div>
      </div>

      {/* Daily rate */}
      <p className="text-xs text-[#b0b0b0] text-center mb-4">
        ~{dailyRate.toFixed(1)}% daily return
      </p>

      {/* Button */}
      {isLocked ? (
        <Button variant="ghost" size="md" fullWidth disabled>
          <Lock className="w-4 h-4 mr-1" /> Reach Tier {tier.tier - 1} first
        </Button>
      ) : !isAffordable && canAfford ? (
        <Button variant="ghost" size="md" fullWidth disabled>
          Need ${canAfford.shortfall.toFixed(2)} more
        </Button>
      ) : (
        <Button
          variant="primary"
          size="md"
          fullWidth
          onClick={onBuy}
          loading={isPurchasing}
          disabled={!canBuy}
        >
          {isPurchasing ? 'Purchasing...' : 'Buy Machine'}
        </Button>
      )}
    </motion.div>
  );
}
