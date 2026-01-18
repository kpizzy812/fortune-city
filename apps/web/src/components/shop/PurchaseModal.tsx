'use client';

import { AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import type { TierInfo, CanAffordResponse } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';

interface PurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: TierInfo | null;
  canAfford: CanAffordResponse | null;
  onConfirm: () => void;
  isLoading: boolean;
  userBalance: number;
}

export function PurchaseModal({
  isOpen,
  onClose,
  tier,
  canAfford,
  onConfirm,
  isLoading,
  userBalance,
}: PurchaseModalProps) {
  if (!tier) return null;

  // Calculate profit considering reinvest penalty
  const baseProfit = tier.price * (tier.yieldPercent / 100 - 1);
  const reductionRate = canAfford?.nextProfitReduction ?? 0;
  const actualProfit = baseProfit * (1 - reductionRate / 100);
  const totalYield = tier.price + actualProfit;
  const balanceAfter = userBalance - tier.price;
  const isLowBalance = balanceAfter < tier.price * 0.1; // Less than 10% of price left
  const hasReinvestPenalty = reductionRate > 0;
  const isUpgrade = canAfford?.isUpgrade ?? false;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Purchase ${tier.name}?`}>
      <div className="space-y-4">
        {/* Machine preview */}
        <div className="flex items-center gap-4 p-4 bg-[#1a0a2e] rounded-xl">
          <span className="text-5xl">{tier.emoji}</span>
          <div>
            <h3 className="font-bold text-white text-xl">{tier.name}</h3>
            <p className="text-[#b0b0b0]">Tier {tier.tier}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">Price</span>
            <span className="font-mono text-[#ffd700] font-semibold">
              ${tier.price.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">Duration</span>
            <span className="font-mono text-white">{tier.lifespanDays} days</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">Expected Yield</span>
            <span className="font-mono text-[#00ff88]">
              ${totalYield.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">Profit</span>
            <span className={`font-mono ${hasReinvestPenalty ? 'text-[#ffaa00]' : 'text-[#00ff88]'}`}>
              ${actualProfit.toFixed(2)}
              {hasReinvestPenalty && (
                <span className="text-xs ml-1 text-[#ff6666]">
                  (-{reductionRate.toFixed(0)}%)
                </span>
              )}
            </span>
          </div>
        </div>

        {/* Balance info */}
        <div className="p-4 bg-[#1a0a2e] rounded-xl space-y-2">
          <div className="flex justify-between">
            <span className="text-[#b0b0b0]">Your balance</span>
            <span className="font-mono text-white">${userBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#b0b0b0]">After purchase</span>
            <span
              className={`font-mono ${isLowBalance ? 'text-[#ffaa00]' : 'text-white'}`}
            >
              ${balanceAfter.toFixed(2)}
            </span>
          </div>
        </div>

        {/* Low balance warning */}
        {isLowBalance && balanceAfter >= 0 && (
          <div className="p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
            <p className="text-[#ffaa00] text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 flex-shrink-0" />
              Your balance will be low after this purchase
            </p>
          </div>
        )}

        {/* Reinvest penalty warning */}
        {hasReinvestPenalty && (
          <div className="p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
            <p className="text-[#ffaa00] text-sm flex items-center gap-2 font-semibold mb-1">
              <TrendingDown className="w-4 h-4 flex-shrink-0" />
              Repeat purchase of the same tier
            </p>
            <p className="text-xs text-[#b0b0b0] mb-2">
              This is your {canAfford?.nextReinvestRound ?? 1}
              {canAfford?.nextReinvestRound === 2 ? 'nd' : canAfford?.nextReinvestRound === 3 ? 'rd' : 'th'} machine
              of this tier. Profit reduced by {reductionRate.toFixed(0)}%.
            </p>
            {tier.tier < 10 && (
              <p className="text-xs text-[#00ff88] flex items-center gap-1">
                <TrendingUp className="w-3 h-3" />
                Tip: Upgrade to Tier {tier.tier + 1} for full profit!
              </p>
            )}
          </div>
        )}

        {/* Upgrade bonus info */}
        {isUpgrade && (
          <div className="p-3 bg-[#00ff88]/10 border border-[#00ff88]/30 rounded-lg">
            <p className="text-[#00ff88] text-sm flex items-center gap-2 font-semibold">
              <TrendingUp className="w-4 h-4 flex-shrink-0" />
              New tier unlocked!
            </p>
            <p className="text-xs text-[#b0b0b0]">
              First purchase of this tier - you&apos;ll get maximum profit with no penalties!
            </p>
          </div>
        )}

        {/* Cannot afford warning */}
        {canAfford && !canAfford.canAfford && (
          <div className="p-3 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
            <p className="text-[#ff4444] text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              Insufficient balance. You need ${canAfford.shortfall.toFixed(2)} more.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="ghost"
            size="lg"
            fullWidth
            onClick={onClose}
            disabled={isLoading}
          >
            Cancel
          </Button>
          <Button
            variant="gold"
            size="lg"
            fullWidth
            onClick={onConfirm}
            loading={isLoading}
            disabled={!canAfford?.canAfford || isLoading}
          >
            {isLoading ? 'Purchasing...' : 'Confirm'}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
