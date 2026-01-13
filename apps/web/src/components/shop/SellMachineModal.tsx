'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { Users, Zap, Clock, TrendingDown, AlertTriangle } from 'lucide-react';
import type { SaleOptions, Machine } from '@/types';

interface SellMachineModalProps {
  isOpen: boolean;
  onClose: () => void;
  machine: Machine | null;
  saleOptions: SaleOptions | null;
  isLoading: boolean;
  onSellAuction: () => Promise<void>;
  onSellPawnshop: () => Promise<void>;
}

export function SellMachineModal({
  isOpen,
  onClose,
  machine,
  saleOptions,
  isLoading,
  onSellAuction,
  onSellPawnshop,
}: SellMachineModalProps) {
  const t = useTranslations('sell');
  const tCommon = useTranslations('common');
  const [selectedMethod, setSelectedMethod] = useState<'auction' | 'pawnshop' | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  if (!machine || !saleOptions) return null;

  const { auction, pawnshop, recommendation, recommendationReasonCode, recommendationReasonParams } = saleOptions;

  const handleConfirm = async () => {
    if (!selectedMethod) return;

    setIsConfirming(true);
    try {
      if (selectedMethod === 'auction') {
        await onSellAuction();
      } else {
        await onSellPawnshop();
      }
      onClose();
    } finally {
      setIsConfirming(false);
    }
  };

  const resetAndClose = () => {
    setSelectedMethod(null);
    setIsConfirming(false);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={resetAndClose} title={t('title', { name: machine.tierInfo.name })}>
      <div className="space-y-4">
        {/* Machine info */}
        <div className="flex items-center gap-3 p-3 bg-[#1a0a2e] rounded-lg border border-[#ff2d95]/20">
          <span className="text-4xl">{machine.tierInfo.emoji}</span>
          <div>
            <p className="font-semibold text-white">{machine.tierInfo.name}</p>
            <p className="text-xs text-[#b0b0b0]">
              {t('machineInfo', { tier: machine.tier, wear: auction.wearPercent.toFixed(0) })}
            </p>
          </div>
        </div>

        {/* Recommendation */}
        <div className={`
          p-3 rounded-lg border
          ${recommendation === 'auction'
            ? 'bg-[#00d4ff]/10 border-[#00d4ff]/30'
            : recommendation === 'pawnshop'
              ? 'bg-[#ffd700]/10 border-[#ffd700]/30'
              : 'bg-[#ff4444]/10 border-[#ff4444]/30'
          }
        `}>
          <p className="text-xs text-[#b0b0b0] mb-1">{t('recommended')}</p>
          <p className="text-sm text-white font-medium">
            {t(`reasons.${recommendationReasonCode}`, recommendationReasonParams)}
          </p>
        </div>

        {/* Sale options */}
        <div className="grid grid-cols-1 gap-3">
          {/* Auction option */}
          <button
            onClick={() => setSelectedMethod('auction')}
            disabled={!auction.canList || isLoading}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${!auction.canList
                ? 'opacity-50 cursor-not-allowed border-[#6b6b6b]/30 bg-[#1a0a2e]/50'
                : selectedMethod === 'auction'
                  ? 'border-[#00d4ff] bg-[#00d4ff]/10'
                  : 'border-[#ff2d95]/30 bg-[#1a0a2e] hover:border-[#00d4ff]/50'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00d4ff]" />
                <span className="font-semibold text-white">{t('auction.title')}</span>
              </div>
              {recommendation === 'auction' && (
                <span className="text-[10px] px-2 py-0.5 bg-[#00ff88]/20 text-[#00ff88] rounded-full">
                  {t('auction.recommendedTag')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[#b0b0b0] text-xs">{t('auction.youllReceive')}</p>
                <p className="text-[#00ff88] font-bold">${auction.expectedPayout.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[#b0b0b0] text-xs">{t('auction.commission')}</p>
                <p className="text-[#ff4444]">{(auction.commissionRate * 100).toFixed(0)}%</p>
              </div>
            </div>

            <div className="flex items-center gap-1 mt-2 text-xs text-[#b0b0b0]">
              <Clock className="w-3 h-3" />
              <span>
                {auction.queueLength === 0
                  ? t('auction.noQueue')
                  : t('auction.queueLength', { count: auction.queueLength })}
              </span>
            </div>

            {!auction.canList && auction.reason && (
              <p className="text-xs text-[#ff4444] mt-2">{auction.reason}</p>
            )}
          </button>

          {/* Pawnshop option */}
          <button
            onClick={() => setSelectedMethod('pawnshop')}
            disabled={!pawnshop.canSell || isLoading}
            className={`
              p-4 rounded-lg border-2 text-left transition-all
              ${!pawnshop.canSell
                ? 'opacity-50 cursor-not-allowed border-[#6b6b6b]/30 bg-[#1a0a2e]/50'
                : selectedMethod === 'pawnshop'
                  ? 'border-[#ffd700] bg-[#ffd700]/10'
                  : 'border-[#ff2d95]/30 bg-[#1a0a2e] hover:border-[#ffd700]/50'
              }
            `}
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Zap className="w-5 h-5 text-[#ffd700]" />
                <span className="font-semibold text-white">{t('pawnshop.title')}</span>
              </div>
              {recommendation === 'pawnshop' && (
                <span className="text-[10px] px-2 py-0.5 bg-[#00ff88]/20 text-[#00ff88] rounded-full">
                  {t('pawnshop.recommendedTag')}
                </span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <p className="text-[#b0b0b0] text-xs">{t('pawnshop.youllReceive')}</p>
                <p className="text-[#00ff88] font-bold">${pawnshop.expectedPayout.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[#b0b0b0] text-xs">{t('pawnshop.commission')}</p>
                <p className="text-[#ff4444]">{(pawnshop.commissionRate * 100).toFixed(0)}%</p>
              </div>
            </div>

            <div className="flex items-center gap-1 mt-2 text-xs text-[#b0b0b0]">
              <TrendingDown className="w-3 h-3" />
              <span>{t('pawnshop.profitDeducted', { amount: pawnshop.collectedProfit.toFixed(2) })}</span>
            </div>

            {!pawnshop.canSell && pawnshop.reason && (
              <p className="text-xs text-[#ff4444] mt-2">{pawnshop.reason}</p>
            )}
          </button>
        </div>

        {/* Warning */}
        {selectedMethod && (
          <div className="flex items-start gap-2 p-3 bg-[#ff4444]/10 rounded-lg border border-[#ff4444]/30">
            <AlertTriangle className="w-4 h-4 text-[#ff4444] mt-0.5 flex-shrink-0" />
            <p className="text-xs text-[#ff4444]">
              {selectedMethod === 'auction'
                ? t('auction.warning')
                : t('pawnshop.warning')
              }
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button
            variant="secondary"
            size="md"
            fullWidth
            onClick={resetAndClose}
            disabled={isConfirming}
          >
            {tCommon('cancel')}
          </Button>
          <Button
            variant={selectedMethod === 'pawnshop' ? 'gold' : 'primary'}
            size="md"
            fullWidth
            onClick={handleConfirm}
            loading={isConfirming}
            disabled={!selectedMethod || isLoading}
          >
            {selectedMethod === 'auction'
              ? t('auction.listOnAuction')
              : selectedMethod === 'pawnshop'
                ? t('pawnshop.sellNow')
                : t('selectOption')}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
