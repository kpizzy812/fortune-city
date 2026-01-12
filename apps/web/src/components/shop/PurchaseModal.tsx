'use client';

import { AlertTriangle, XCircle } from 'lucide-react';
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

  const profit = tier.price * (tier.yieldPercent / 100 - 1);
  const totalYield = tier.price * (tier.yieldPercent / 100);
  const balanceAfter = userBalance - tier.price;
  const isLowBalance = balanceAfter < tier.price * 0.1; // Less than 10% of price left

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
              ${totalYield.toFixed(2)} (+{tier.yieldPercent - 100}%)
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">Profit</span>
            <span className="font-mono text-[#00ff88]">${profit.toFixed(2)}</span>
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
