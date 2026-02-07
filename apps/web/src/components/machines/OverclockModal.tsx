'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Zap } from 'lucide-react';
import type { OverclockInfo, PaymentMethod } from '@/types';

interface OverclockModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (level: number, paymentMethod: PaymentMethod) => void;
  overclockInfo: OverclockInfo | null;
  coinBoxCurrent: number;
  userBalance: number;
  userFame: number;
  isLoading: boolean;
}

const LEVEL_COLORS: Record<string, { border: string; bg: string; text: string }> = {
  '1.2': { border: 'border-[#00d4ff]/40', bg: 'from-[#00d4ff]/10 to-transparent', text: 'text-[#00d4ff]' },
  '1.5': { border: 'border-[#ffd700]/40', bg: 'from-[#ffd700]/10 to-transparent', text: 'text-[#ffd700]' },
  '2': { border: 'border-[#ff2d95]/40', bg: 'from-[#ff2d95]/10 to-transparent', text: 'text-[#ff2d95]' },
};

function getLevelColor(level: number) {
  const key = level === 2 ? '2' : String(level);
  return LEVEL_COLORS[key] ?? LEVEL_COLORS['1.2'];
}

export function OverclockModal({
  isOpen,
  onClose,
  onConfirm,
  overclockInfo,
  coinBoxCurrent,
  userBalance,
  userFame,
  isLoading,
}: OverclockModalProps) {
  const t = useTranslations('overclock');
  const tCommon = useTranslations('common');
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);

  if (!overclockInfo) return null;

  // Already has active overclock
  if (overclockInfo.isActive) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`⚡ ${t('title')}`}>
        <div className="space-y-3">
          <div className="text-center py-4">
            <div className="text-4xl mb-2">⚡</div>
            <h3 className="text-lg font-bold text-white mb-1">
              {t('activeTitle', { mult: `x${overclockInfo.currentMultiplier}` })}
            </h3>
            <p className="text-sm text-[#b0b0b0]">{t('activeDescription')}</p>
          </div>
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </Modal>
    );
  }

  // Can't purchase (machine not active)
  if (!overclockInfo.canPurchase) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title={`⚡ ${t('title')}`}>
        <div className="space-y-3">
          <p className="text-sm text-center text-[#b0b0b0] py-4">{t('unavailable')}</p>
          <Button variant="primary" size="md" fullWidth onClick={onClose}>
            {tCommon('close')}
          </Button>
        </div>
      </Modal>
    );
  }

  const selectedLevelInfo = overclockInfo.levels.find(l => l.level === selectedLevel);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`⚡ ${t('title')}`}>
      <div className="space-y-3">
        {/* Description */}
        <p className="text-xs text-[#b0b0b0]">{t('description')}</p>

        {/* Level cards */}
        <div className="grid grid-cols-3 gap-2">
          {overclockInfo.levels.map((level) => {
            const color = getLevelColor(level.level);
            const isSelected = selectedLevel === level.level;
            const canAffordF = userBalance >= level.fortunePrice;
            const canAffordFame = userFame >= level.famePrice;
            const canAffordAny = canAffordF || canAffordFame;
            const boostedAmount = coinBoxCurrent * level.level;

            return (
              <button
                key={level.level}
                onClick={() => setSelectedLevel(isSelected ? null : level.level)}
                disabled={!canAffordAny}
                className={`
                  relative rounded-lg p-2 border text-center transition-all
                  ${isSelected
                    ? `${color.border} bg-gradient-to-b ${color.bg} ring-1 ring-white/20`
                    : canAffordAny
                      ? `border-white/10 bg-[#1a0a2e] hover:${color.border}`
                      : 'border-white/5 bg-[#1a0a2e]/50 opacity-40'
                  }
                `}
              >
                <p className={`text-lg font-bold ${color.text}`}>x{level.level}</p>
                <p className="text-[10px] text-[#b0b0b0]">+{level.bonusPercent}%</p>
                {coinBoxCurrent > 0 && (
                  <p className="text-[9px] text-[#00ff88] mt-0.5">
                    ${boostedAmount.toFixed(2)}
                  </p>
                )}
              </button>
            );
          })}
        </div>

        {/* Payment section — appears when level selected */}
        {selectedLevelInfo && (
          <div className="space-y-2 animate-in fade-in slide-in-from-bottom-2 duration-200">
            {/* Preview */}
            {coinBoxCurrent > 0 && (
              <div className="bg-[#1a0a2e] rounded-lg p-2 border border-[#00ff88]/20 text-center">
                <p className="text-[10px] text-[#b0b0b0]">{t('nextCollect')}</p>
                <p className="text-sm font-mono">
                  <span className="text-white">${coinBoxCurrent.toFixed(2)}</span>
                  <span className="text-[#b0b0b0] mx-1">→</span>
                  <span className="text-[#00ff88] font-bold">
                    ${(coinBoxCurrent * selectedLevelInfo.level).toFixed(2)}
                  </span>
                </p>
              </div>
            )}

            {/* Payment buttons */}
            <div className="grid grid-cols-2 gap-2">
              {/* Fortune */}
              <div className={`rounded-lg p-2 border ${
                userBalance >= selectedLevelInfo.fortunePrice
                  ? 'bg-[#1a0a2e] border-[#ffd700]/30'
                  : 'bg-[#1a0a2e]/50 border-white/10 opacity-50'
              }`}>
                <p className="text-[10px] text-[#b0b0b0] mb-1 text-center">
                  ${userBalance.toFixed(2)}
                </p>
                <Button
                  variant="gold"
                  size="sm"
                  fullWidth
                  onClick={() => onConfirm(selectedLevelInfo.level, 'fortune')}
                  loading={isLoading}
                  disabled={userBalance < selectedLevelInfo.fortunePrice}
                >
                  ${selectedLevelInfo.fortunePrice}
                </Button>
              </div>
              {/* Fame */}
              <div className={`rounded-lg p-2 border ${
                userFame >= selectedLevelInfo.famePrice
                  ? 'bg-[#1a0a2e] border-[#a855f7]/30'
                  : 'bg-[#1a0a2e]/50 border-white/10 opacity-50'
              }`}>
                <p className="text-[10px] text-[#b0b0b0] mb-1 text-center">
                  {userFame}⚡
                </p>
                <Button
                  variant="primary"
                  size="sm"
                  fullWidth
                  onClick={() => onConfirm(selectedLevelInfo.level, 'fame')}
                  loading={isLoading}
                  disabled={userFame < selectedLevelInfo.famePrice}
                >
                  {selectedLevelInfo.famePrice}⚡
                </Button>
              </div>
            </div>

            {/* Warning */}
            <p className="text-[9px] text-[#b0b0b0]/60 text-center">{t('warning')}</p>
          </div>
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
      </div>
    </Modal>
  );
}
