'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TrendingUp } from 'lucide-react';
import type { GambleInfo } from '@/types';

interface FortuneGambleUpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  gambleInfo: GambleInfo | null;
  userBalance: number;
  isLoading: boolean;
}

export function FortuneGambleUpgradeModal({
  isOpen,
  onClose,
  onConfirm,
  gambleInfo,
  userBalance,
  isLoading,
}: FortuneGambleUpgradeModalProps) {
  if (!gambleInfo) return null;

  const canAfford = gambleInfo.upgradeCost !== null && userBalance >= gambleInfo.upgradeCost;
  const isMaxLevel = !gambleInfo.canUpgrade;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⬆️ Upgrade Fortune's Gamble">
      <div className="space-y-4">
        {isMaxLevel ? (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">👑</div>
            <h3 className="text-xl font-bold text-white mb-2">Maximum Level Reached!</h3>
            <p className="text-[#b0b0b0]">
              You have the best possible odds for Fortune&apos;s Gamble.
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
                  <div className="text-2xl font-bold text-[#00d4ff]">
                    Level {gambleInfo.currentLevel}
                  </div>
                </div>
              </div>

              {/* Next level */}
              <div className="bg-[#00ff88]/10 rounded-lg p-3 border border-[#00ff88]/30">
                <div className="text-center">
                  <p className="text-xs text-[#00ff88] mb-2">Next Level</p>
                  <div className="text-2xl font-bold text-[#00ff88]">
                    Level {gambleInfo.nextLevel}
                  </div>
                </div>
              </div>
            </div>

            {/* Improvement indicator */}
            <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#00d4ff]/20">
              <div className="flex items-center justify-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-[#00ff88]" />
                <span className="text-white">Better odds at higher levels</span>
              </div>
            </div>

            {/* Cost */}
            <div className="bg-[#1a0a2e] rounded-lg p-4 border border-[#ff2d95]/30">
              <div className="flex justify-between items-center">
                <span className="text-[#b0b0b0]">Upgrade Cost:</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${gambleInfo.upgradeCost?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-[#b0b0b0]">
                    Your balance: ${userBalance.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {!canAfford && gambleInfo.upgradeCost !== null && (
              <div className="bg-[#ff4444]/10 rounded-lg p-3 border border-[#ff4444]/30">
                <p className="text-xs text-center text-[#ff4444]">
                  Insufficient balance. Need ${(gambleInfo.upgradeCost - userBalance).toFixed(2)} more.
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
                ⬆️ Upgrade
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
