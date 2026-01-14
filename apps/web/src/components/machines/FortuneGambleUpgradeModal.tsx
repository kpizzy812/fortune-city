'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { TrendingUp } from 'lucide-react';
import { useTranslations } from 'next-intl';
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
  const t = useTranslations('gambleUpgrade');
  const tCommon = useTranslations('common');

  if (!gambleInfo) return null;

  const canAfford = gambleInfo.upgradeCost !== null && userBalance >= gambleInfo.upgradeCost;
  const isMaxLevel = !gambleInfo.canUpgrade;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`⬆️ ${t('title')}`}>
      <div className="space-y-4">
        {isMaxLevel ? (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">👑</div>
            <h3 className="text-xl font-bold text-white mb-2">{t('maxReachedTitle')}</h3>
            <p className="text-[#b0b0b0]">
              {t('maxReachedDescription')}
            </p>
          </div>
        ) : (
          <>
            {/* Current vs Next comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Current level */}
              <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#ff2d95]/30">
                <div className="text-center">
                  <p className="text-xs text-[#b0b0b0] mb-2">{t('current')}</p>
                  <div className="text-2xl font-bold text-[#00d4ff]">
                    {t('level', { level: gambleInfo.currentLevel })}
                  </div>
                </div>
              </div>

              {/* Next level */}
              <div className="bg-[#00ff88]/10 rounded-lg p-3 border border-[#00ff88]/30">
                <div className="text-center">
                  <p className="text-xs text-[#00ff88] mb-2">{t('nextLevel')}</p>
                  <div className="text-2xl font-bold text-[#00ff88]">
                    {t('level', { level: gambleInfo.nextLevel ?? 0 })}
                  </div>
                </div>
              </div>
            </div>

            {/* Improvement indicator */}
            <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#00d4ff]/20">
              <div className="flex items-center justify-center gap-2 text-sm">
                <TrendingUp className="w-4 h-4 text-[#00ff88]" />
                <span className="text-white">{t('betterOdds')}</span>
              </div>
            </div>

            {/* Cost */}
            <div className="bg-[#1a0a2e] rounded-lg p-4 border border-[#ff2d95]/30">
              <div className="flex justify-between items-center">
                <span className="text-[#b0b0b0]">{t('upgradeCost')}</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${gambleInfo.upgradeCost?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-[#b0b0b0]">
                    {t('yourBalance')} ${userBalance.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {!canAfford && gambleInfo.upgradeCost !== null && (
              <div className="bg-[#ff4444]/10 rounded-lg p-3 border border-[#ff4444]/30">
                <p className="text-xs text-center text-[#ff4444]">
                  {t('insufficientBalance', { amount: (gambleInfo.upgradeCost - userBalance).toFixed(2) })}
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
                {tCommon('cancel')}
              </Button>
              <Button
                variant="primary"
                size="md"
                fullWidth
                onClick={onConfirm}
                loading={isLoading}
                disabled={!canAfford}
              >
                ⬆️ {t('upgrade')}
              </Button>
            </div>
          </>
        )}

        {/* Info */}
        {isMaxLevel && (
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            {tCommon('close')}
          </Button>
        )}
      </div>
    </Modal>
  );
}
