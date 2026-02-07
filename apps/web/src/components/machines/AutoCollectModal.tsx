'use client';

import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Briefcase, Percent } from 'lucide-react';
import type { AutoCollectInfo, PaymentMethod } from '@/types';

interface AutoCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (paymentMethod: PaymentMethod) => void;
  autoCollectInfo: AutoCollectInfo | null;
  userBalance: number;
  userFame: number;
  isLoading: boolean;
}

export function AutoCollectModal({
  isOpen,
  onClose,
  onConfirm,
  autoCollectInfo,
  userBalance,
  userFame,
  isLoading,
}: AutoCollectModalProps) {
  const t = useTranslations('collector');
  const tCommon = useTranslations('common');

  if (!autoCollectInfo || autoCollectInfo.hireCost === undefined) return null;

  const canAffordFortune = userBalance >= autoCollectInfo.hireCost;
  const canAffordFame = userFame >= (autoCollectInfo.hireCostFame ?? Infinity);
  const alreadyPurchased = autoCollectInfo.alreadyPurchased;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`💼 ${t('title')}`}>
      <div className="space-y-3">
        {alreadyPurchased ? (
          <div className="text-center py-4">
            <div className="text-5xl mb-3">🕴️</div>
            <h3 className="text-lg font-bold text-white mb-1">{t('activeTitle')}</h3>
            <p className="text-sm text-[#b0b0b0]">{t('activeDescription')}</p>
            <div className="mt-3 bg-[#1a0a2e] rounded-lg p-2 border border-[#ffd700]/30">
              <p className="text-xs text-[#b0b0b0]">
                {t('salaryInfo', { percent: autoCollectInfo.salaryPercent })}
              </p>
            </div>
            {autoCollectInfo.purchasedAt && (
              <p className="text-[10px] text-[#00d4ff] mt-2">
                {t('hiredAt')} {new Date(autoCollectInfo.purchasedAt).toLocaleString()}
              </p>
            )}
            <div className="mt-3">
              <Button variant="primary" size="md" fullWidth onClick={onClose}>
                {tCommon('close')}
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Compact hero */}
            <div className="bg-gradient-to-br from-[#ffd700]/10 to-[#ff2d95]/10 rounded-lg p-3 border border-[#ffd700]/30">
              <div className="flex items-center gap-2 mb-1">
                <Briefcase className="w-5 h-5 text-[#ffd700] shrink-0" />
                <h3 className="text-sm font-bold text-white">{t('hireTitle')}</h3>
              </div>
              <p className="text-xs text-[#b0b0b0]">{t('hireDescription')}</p>
            </div>

            {/* Terms — compact list */}
            <div className="flex items-center gap-3 text-xs text-[#b0b0b0] px-1">
              <span className="flex items-center gap-1">
                <Percent className="w-3 h-3 text-[#ff2d95]" />
                {t('termSalary', { percent: autoCollectInfo.salaryPercent })}
              </span>
            </div>

            {/* Payment options — two buttons side by side */}
            <div className="grid grid-cols-2 gap-2">
              {/* Fortune */}
              <div className={`rounded-lg p-2.5 border ${canAffordFortune ? 'bg-[#1a0a2e] border-[#ffd700]/30' : 'bg-[#1a0a2e]/50 border-white/10 opacity-50'}`}>
                <p className="text-[10px] text-[#b0b0b0] mb-1 text-center">
                  ${userBalance.toFixed(2)}
                </p>
                <Button
                  variant="gold"
                  size="sm"
                  fullWidth
                  onClick={() => onConfirm('fortune')}
                  loading={isLoading}
                  disabled={!canAffordFortune}
                >
                  ${autoCollectInfo.hireCost}
                </Button>
              </div>
              {/* Fame */}
              <div className={`rounded-lg p-2.5 border ${canAffordFame ? 'bg-[#1a0a2e] border-[#a855f7]/30' : 'bg-[#1a0a2e]/50 border-white/10 opacity-50'}`}>
                <p className="text-[10px] text-[#b0b0b0] mb-1 text-center">
                  {userFame}⚡
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => onConfirm('fame')}
                  loading={isLoading}
                  disabled={!canAffordFame}
                >
                  {autoCollectInfo.hireCostFame}⚡
                </Button>
              </div>
            </div>

            {/* Warning if can't afford either */}
            {!canAffordFortune && !canAffordFame && (
              <p className="text-[10px] text-center text-[#ff4444]">
                {t('insufficientBoth')}
              </p>
            )}

            {/* Cancel */}
            <Button
              variant="secondary"
              size="sm"
              fullWidth
              onClick={onClose}
              disabled={isLoading}
            >
              {tCommon('cancel')}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}
