'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Package, TrendingUp } from 'lucide-react';
import type { CoinBoxInfo } from '@/types';

interface CoinBoxUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  coinBoxInfo: CoinBoxInfo | null;
  userBalance: number;
  isLoading: boolean;
}

export function CoinBoxUpgradeModal({
  isOpen,
  onClose,
  onConfirm,
  coinBoxInfo,
  userBalance,
  isLoading,
}: CoinBoxUpgradeModalProps) {
  if (!coinBoxInfo) return null;

  const canAfford = coinBoxInfo.upgradeCost !== null && userBalance >= coinBoxInfo.upgradeCost;
  const isMaxLevel = !coinBoxInfo.canUpgrade;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="📦 Upgrade Coin Box">
      <div className="space-y-4">
        {isMaxLevel ? (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">👑</div>
            <h3 className="text-xl font-bold text-white mb-2">Maximum Capacity Reached!</h3>
            <p className="text-[#b0b0b0]">
              Your Coin Box has the maximum storage capacity (48 hours).
            </p>
          </div>
        ) : (
          <>
            {/* Current vs Next comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Current level */}
              <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#ff2d95]/30">
                <div className="text-center">
                  <p className="text-xs text-[#b0b0b0] mb-2">Current</p>
                  <div className="text-sm font-semibold text-white mb-1">
                    Level {coinBoxInfo.currentLevel}
                  </div>
                  <div className="text-lg font-bold text-[#00d4ff]">
                    {coinBoxInfo.currentCapacityHours}h
                  </div>
                  <div className="text-xs text-[#b0b0b0] mt-1">
                    Capacity
                  </div>
                </div>
              </div>

              {/* Next level */}
              <div className="bg-[#00ff88]/10 rounded-lg p-3 border border-[#00ff88]/30">
                <div className="text-center">
                  <p className="text-xs text-[#00ff88] mb-2">Next Level</p>
                  <div className="text-sm font-semibold text-white mb-1">
                    Level {coinBoxInfo.nextLevel}
                  </div>
                  <div className="text-lg font-bold text-[#00ff88]">
                    {coinBoxInfo.nextCapacityHours || '-'}h
                  </div>
                  <div className="text-xs text-[#00ff88] mt-1">
                    Capacity
                  </div>
                </div>
              </div>
            </div>

            {/* Improvement indicator */}
            <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#00d4ff]/20">
              <div className="flex items-center justify-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-[#00ff88]" />
                <span className="text-white">
                  {coinBoxInfo.nextCapacityHours
                    ? `+${coinBoxInfo.nextCapacityHours - coinBoxInfo.currentCapacityHours}h`
                    : '-'}{' '}
                  more storage
                </span>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#ffd700]/20">
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-[#ffd700] mt-0.5" />
                <div className="text-xs text-[#b0b0b0]">
                  <span className="text-white font-semibold">Why upgrade?</span>
                  <br />
                  Larger capacity means less frequent collections and no income loss when away.
                </div>
              </div>
            </div>

            {/* Cost */}
            <div className="bg-[#1a0a2e] rounded-lg p-4 border border-[#ff2d95]/30">
              <div className="flex justify-between items-center">
                <span className="text-[#b0b0b0]">Upgrade Cost:</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${coinBoxInfo.upgradeCost?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-[#b0b0b0]">
                    Your balance: ${userBalance.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {!canAfford && coinBoxInfo.upgradeCost !== null && (
              <div className="bg-[#ff4444]/10 rounded-lg p-3 border border-[#ff4444]/30">
                <p className="text-xs text-center text-[#ff4444]">
                  Insufficient balance. Need ${(coinBoxInfo.upgradeCost - userBalance).toFixed(2)} more.
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button
                variant="secondary"
                size="md"
                fullWidth
                onClick={onClose}
                disabled={isLoading}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={onConfirm}
                loading={isLoading}
                disabled={!canAfford}
              >
                📦 Upgrade
              </Button>
            </div>
          </>
        )}

        {/* Info */}
        {isMaxLevel && (
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </Modal>
  );
}
