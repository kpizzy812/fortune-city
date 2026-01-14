'use client';

import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useTranslations } from 'next-intl';
import type { GambleInfo } from '@/types';

interface RiskyCollectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  amount: number;
  gambleInfo: GambleInfo | null;
  isLoading: boolean;
}

export function RiskyCollectModal({
  isOpen,
  onClose,
  onConfirm,
  amount,
  isLoading,
}: RiskyCollectModalProps) {
  const t = useTranslations('riskyCollect');
  const tCommon = useTranslations('common');

  const winAmount = (amount * 2).toFixed(2);
  const loseAmount = (amount * 0.5).toFixed(2);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`🎲 ${t('title')}`}>
      <div className="space-y-4">
        {/* Current amount */}
        <div className="bg-[#1a0a2e] rounded-lg p-4 border border-[#00d4ff]/30">
          <p className="text-sm text-[#b0b0b0] mb-1">{t('currentCoinBox')}</p>
          <p className="text-2xl font-bold text-[#00d4ff]">${amount.toFixed(2)}</p>
        </div>

        {/* Explanation */}
        <div className="text-center text-[#b0b0b0] text-sm">
          {t('description')}
        </div>

        {/* Outcomes */}
        <div className="grid grid-cols-2 gap-3">
          {/* Win outcome */}
          <div className="bg-[#00ff88]/10 rounded-lg p-3 border border-[#00ff88]/30">
            <div className="text-center">
              <div className="text-3xl mb-1">🎰</div>
              <div className="text-xs text-[#b0b0b0] mb-1">{t('win')}</div>
              <div className="text-lg font-bold text-[#00ff88]">${winAmount}</div>
            </div>
          </div>

          {/* Lose outcome */}
          <div className="bg-[#ff4444]/10 rounded-lg p-3 border border-[#ff4444]/30">
            <div className="text-center">
              <div className="text-3xl mb-1">💔</div>
              <div className="text-xs text-[#b0b0b0] mb-1">{t('lose')}</div>
              <div className="text-lg font-bold text-[#ff4444]">${loseAmount}</div>
            </div>
          </div>
        </div>

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
          >
            🎲 {t('takeTheRisk')}
          </Button>
        </div>

      </div>
    </Modal>
  );
}
