'use client';

import { useTranslations } from 'next-intl';
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
  const t = useTranslations('coinBoxUpgrade');
  const tCommon = useTranslations('common');

  if (!coinBoxInfo) return null;

  const canAfford = coinBoxInfo.upgradeCost !== null && userBalance >= coinBoxInfo.upgradeCost;
  const isMaxLevel = !coinBoxInfo.canUpgrade;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`📦 ${t('title')}`}>
      <div className="space-y-4">
        {isMaxLevel ? (
          <div className="text-center py-6">
            <div className="text-6xl mb-4">👑</div>
            <h3 className="text-xl font-bold text-white mb-2">{t('maxReachedTitle')}</h3>
            <p className="text-[#b0b0b0]">{t('maxReachedDescription')}</p>
          </div>
        ) : (
          <>
            {/* Current vs Next comparison */}
            <div className="grid grid-cols-2 gap-3">
              {/* Current level */}
              <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#ff2d95]/30">
                <div className="text-center">
                  <p className="text-xs text-[#b0b0b0] mb-2">{t('current')}</p>
                  <div className="text-sm font-semibold text-white mb-1">
                    {t('level', { level: coinBoxInfo.currentLevel })}
                  </div>
                  <div className="text-lg font-bold text-[#00d4ff]">
                    {coinBoxInfo.currentCapacityHours}h
                  </div>
                  <div className="text-xs text-[#b0b0b0] mt-1">{t('capacity')}</div>
                </div>
              </div>

              {/* Next level */}
              <div className="bg-[#00ff88]/10 rounded-lg p-3 border border-[#00ff88]/30">
                <div className="text-center">
                  <p className="text-xs text-[#00ff88] mb-2">{t('nextLevel')}</p>
                  <div className="text-sm font-semibold text-white mb-1">
                    {t('level', { level: coinBoxInfo.nextLevel ?? '-' })}
                  </div>
                  <div className="text-lg font-bold text-[#00ff88]">
                    {coinBoxInfo.nextCapacityHours || '-'}h
                  </div>
                  <div className="text-xs text-[#00ff88] mt-1">{t('capacity')}</div>
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
                  {t('moreStorage')}
                </span>
              </div>
            </div>

            {/* Benefits */}
            <div className="bg-[#1a0a2e] rounded-lg p-3 border border-[#ffd700]/20">
              <div className="flex items-start gap-2">
                <Package className="w-4 h-4 text-[#ffd700] mt-0.5" />
                <div className="text-xs text-[#b0b0b0]">
                  <span className="text-white font-semibold">{t('whyUpgrade')}</span>
                  <br />
                  {t('whyUpgradeDesc')}
                </div>
              </div>
            </div>

            {/* Cost */}
            <div className="bg-[#1a0a2e] rounded-lg p-4 border border-[#ff2d95]/30">
              <div className="flex justify-between items-center">
                <span className="text-[#b0b0b0]">{t('upgradeCost')}</span>
                <div className="text-right">
                  <div className="text-xl font-bold text-white">
                    ${coinBoxInfo.upgradeCost?.toFixed(2) || '0.00'}
                  </div>
                  <div className="text-xs text-[#b0b0b0]">
                    {tCommon('yourBalance')}: ${userBalance.toFixed(2)}
                  </div>
                </div>
              </div>
            </div>

            {/* Insufficient balance warning */}
            {!canAfford && coinBoxInfo.upgradeCost !== null && (
              <div className="bg-[#ff4444]/10 rounded-lg p-3 border border-[#ff4444]/30">
                <p className="text-xs text-center text-[#ff4444]">
                  {t('insufficientBalance', { amount: (coinBoxInfo.upgradeCost - userBalance).toFixed(2) })}
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
                📦 {t('upgrade')}
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
