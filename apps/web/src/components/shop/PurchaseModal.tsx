'use client';

import { useTranslations } from 'next-intl';
import Image from 'next/image';
import { AlertTriangle, XCircle, TrendingUp, TrendingDown } from 'lucide-react';
import type { TierInfo, CanAffordResponse } from '@/types';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';

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
  const t = useTranslations('shop');
  const tCommon = useTranslations('common');

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
  const reinvestRound = canAfford?.nextReinvestRound ?? 1;

  // Get ordinal suffix
  const getOrdinal = (n: number) => {
    if (n === 2) return t('reinvest.ordinal2');
    if (n === 3) return t('reinvest.ordinal3');
    return t('reinvest.ordinalOther');
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={t('purchaseConfirm', { name: tier.name })}>
      <div className="space-y-4">
        {/* Machine preview */}
        <div className="flex items-center gap-4 p-3 bg-[#1a0a2e] rounded-xl">
          <Image src={tier.imageUrl} alt={tier.name} width={56} height={56} className="object-contain" />
          <div>
            <h3 className="font-bold text-white text-lg">{tier.name}</h3>
            <p className="text-[#b0b0b0] text-sm">{t('tier')} {tier.tier}</p>
          </div>
        </div>

        {/* Details */}
        <div className="space-y-2">
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">{t('price')}</span>
            <span className="font-mono text-[#ffd700] font-semibold">
              ${tier.price.toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">{t('duration')}</span>
            <span className="font-mono text-white">{tier.lifespanDays} {tCommon('days')}</span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <span className="text-[#b0b0b0]">{t('expectedYield')}</span>
            <span className="font-mono text-[#00ff88]">
              ${totalYield.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between py-2 border-b border-[#3a2a5e]">
            <Tooltip
              content={isUpgrade ? t('reinvest.newTierTooltip') : t('reinvest.penaltyTooltip')}
              position="bottom"
            >
              <span className="text-[#b0b0b0]">{t('profit')}</span>
            </Tooltip>
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
            <span className="text-[#b0b0b0]">{tCommon('yourBalance')}</span>
            <span className="font-mono text-white">${userBalance.toFixed(2)}</span>
          </div>
          {canAfford && canAfford.bonusFortune > 0 && (
            <div className="flex justify-between">
              <span className="text-[#b0b0b0]">{t('bonusBalance')}</span>
              <span className="font-mono text-[#00d4ff]">${canAfford.bonusFortune.toFixed(2)}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span className="text-[#b0b0b0]">{t('afterPurchase')}</span>
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
              {t('lowBalanceWarning')}
            </p>
          </div>
        )}

        {/* Reinvest penalty warning */}
        {hasReinvestPenalty && (
          <div className="p-3 bg-[#ffaa00]/10 border border-[#ffaa00]/30 rounded-lg">
            <div className="flex items-start gap-2 mb-1">
              <TrendingDown className="w-4 h-4 flex-shrink-0 text-[#ffaa00] mt-0.5" />
              <div className="flex-1">
                <Tooltip content={t('reinvest.penaltyTooltip')} position="bottom">
                  <p className="text-[#ffaa00] text-sm font-semibold">
                    {t('reinvest.penaltyWarningTitle')}
                  </p>
                </Tooltip>
              </div>
            </div>
            <p className="text-xs text-[#b0b0b0] mb-2 ml-6">
              {t('reinvest.penaltyWarningText', {
                round: reinvestRound,
                ordinal: getOrdinal(reinvestRound),
                percent: reductionRate.toFixed(0),
              })}
            </p>
            {tier.tier < 10 && (
              <p className="text-xs text-[#00ff88] flex items-center gap-1 ml-6">
                <TrendingUp className="w-3 h-3" />
                {t('reinvest.upgradeTip', { tier: tier.tier + 1 })}
              </p>
            )}
          </div>
        )}

        {/* Cannot afford warning */}
        {canAfford && !canAfford.canAfford && (
          <div className="p-3 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
            <p className="text-[#ff4444] text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 flex-shrink-0" />
              {t('insufficientBalance', { amount: canAfford.shortfall.toFixed(2) })}
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
            {tCommon('cancel')}
          </Button>
          <Button
            variant="gold"
            size="lg"
            fullWidth
            onClick={onConfirm}
            loading={isLoading}
            disabled={!canAfford?.canAfford || isLoading}
          >
            {isLoading ? tCommon('processing') : tCommon('confirm')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
