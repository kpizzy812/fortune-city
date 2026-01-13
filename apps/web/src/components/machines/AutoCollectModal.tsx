'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Zap, Clock, TrendingUp } from 'lucide-react';
import type { AutoCollectInfo } from '@/types';

interface AutoCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  autoCollectInfo: AutoCollectInfo | null;
  userBalance: number;
  isLoading: boolean;
}

export function AutoCollectModal({
  isOpen,
  onClose,
  onConfirm,
  autoCollectInfo,
  userBalance,
  isLoading,
}: AutoCollectModalProps) {
  if (!autoCollectInfo) return null;

  const canAfford = userBalance >= autoCollectInfo.cost;
  const alreadyPurchased = autoCollectInfo.alreadyPurchased;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="⚡ Auto Collect">
      <div className="space-y-4">
        {alreadyPurchased ? (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">✅</div>
            <h3 className="text-xl font-bold text-white mb-2">Auto Collect Active!</h3>
            <p className="text-[#b0b0b0]">
              Your coins are automatically collected when the Coin Box fills up.
            </p>
            {autoCollectInfo.purchasedAt && (
              <p className="text-xs text-[#00d4ff] mt-2">
                Activated: {new Date(autoCollectInfo.purchasedAt).toLocaleString()}
              </p>
            )}
          </div>
        ) : (
          <>
            {/* Hero section */}
            <div className="bg-gradient-to-br from-[#00ff88]/10 to-[#00d4ff]/10 rounded-lg p-4 border border-[#00ff88]/30">
              <div className="flex items-center justify-center gap-3 mb-3">
                <Zap className="w-8 h-8 text-[#00ff88]" />
                <h3 className="text-lg font-bold text-white">Automate Your Income</h3>
              </div>
              <p className="text-sm text-center text-[#b0b0b0]">
                Never miss a collection again. Auto Collect automatically gathers your coins when the Coin Box is full.
              </p>
            </div>

            {/* Benefits grid */}
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#00d4ff]/20">
                <div className="flex flex-col items-center text-center">
                  <Clock className="w-6 h-6 text-[#00d4ff] mb-2" />
                  <p className="text-xs font-semibold text-white mb-1">24/7 Collection</p>
                  <p className="text-[10px] text-[#b0b0b0]">Works even when you&apos;re away</p>
                </div>
              </div>
              <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#00ff88]/20">
                <div className="flex flex-col items-center text-center">
                  <TrendingUp className="w-6 h-6 text-[#00ff88] mb-2" />
                  <p className="text-xs font-semibold text-white mb-1">Zero Loss</p>
                  <p className="text-[10px] text-[#b0b0b0]">No income wasted</p>
                </div>
              </div>
            </div>

            {/* How it works */}
            <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#ff2d95]/20">
              <p className="text-xs text-[#b0b0b0] mb-2">
                <span className="text-white font-semibold">How it works:</span>
              </p>
              <ul className="space-y-1 text-xs text-[#b0b0b0]">
                <li className="flex items-start gap-2">
                  <span className="text-[#00ff88]">✓</span>
                  <span>Automatically collects when Coin Box is full</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00ff88]">✓</span>
                  <span>Prevents income overflow and loss</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-[#00d4ff]">ⓘ</span>
                  <span>Module expires when machine cycle ends</span>
                </li>
              </ul>
            </div>

            {/* Cost */}
            <div className="bg-[#1a0a2e] rounded-lg p-4 border border-[#ffd700]/30">
              <div className="flex justify-between items-center">
                <span className="text-[#b0b0b0]">One-time Cost:</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${autoCollectInfo.cost.toFixed(2)}
                  </div>
                  <div className="text-xs text-[#b0b0b0]">
                    Your balance: ${userBalance.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {!canAfford && (
              <div className="bg-[#ff4444]/10 rounded-lg p-3 border border-[#ff4444]/30">
                <p className="text-xs text-center text-[#ff4444]">
                  Insufficient balance. Need ${(autoCollectInfo.cost - userBalance).toFixed(2)} more.
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
                variant="gold"
                size="md"
                fullWidth
                onClick={onConfirm}
                loading={isLoading}
                disabled={!canAfford}
              >
                ⚡ Activate
              </Button>
            </div>
          </>
        )}

        {/* Close button for already purchased */}
        {alreadyPurchased && (
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            Close
          </Button>
        )}
      </div>
    </Modal>
  );
}
