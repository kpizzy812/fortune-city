'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { Zap, Lock, Unlock, DollarSign } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import {
  FAME_AUTO_UNLOCK_THRESHOLDS,
  calculateTierUnlockFee,
  MACHINE_TIERS,
} from '@fortune-city/shared';

interface UnlockTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUnlocked?: () => void;
  tier: number;
}

export function UnlockTierModal({ isOpen, onClose, onUnlocked, tier }: UnlockTierModalProps) {
  const t = useTranslations('fame');
  const { token, user, refreshUser } = useAuthStore();
  const [isPurchasing, setIsPurchasing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const threshold = FAME_AUTO_UNLOCK_THRESHOLDS[tier] ?? Infinity;
  const totalFameEarned = user?.totalFameEarned ?? 0;
  const progress = threshold > 0 ? Math.min((totalFameEarned / threshold) * 100, 100) : 0;
  const isAutoUnlocked = totalFameEarned >= threshold;

  const tierConfig = MACHINE_TIERS.find((t) => t.tier === tier);
  const unlockFee = tierConfig ? calculateTierUnlockFee(tierConfig.price) : 0;

  const handlePurchaseUnlock = async () => {
    if (!token) return;
    setIsPurchasing(true);
    setError(null);
    try {
      const { api } = await import('@/lib/api');
      await api.purchaseTierUnlock(token, tier);
      await refreshUser();
      onUnlocked?.();
      onClose();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to purchase tier unlock');
    } finally {
      setIsPurchasing(false);
    }
  };

  const handleClose = () => {
    setError(null);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('unlockTierTitle', { tier })}>
      <div className="space-y-5">
        {/* Tier icon */}
        <div className="flex justify-center">
          <div className={`
            w-20 h-20 rounded-2xl flex items-center justify-center
            ${isAutoUnlocked
              ? 'bg-gradient-to-br from-[#facc15]/20 to-[#facc15]/5 border border-[#facc15]/30'
              : 'bg-gradient-to-br from-[#6b6b6b]/20 to-[#6b6b6b]/5 border border-[#6b6b6b]/30'}
          `}>
            {isAutoUnlocked
              ? <Unlock className="w-10 h-10 text-[#facc15]" />
              : <Lock className="w-10 h-10 text-[#6b6b6b]" />}
          </div>
        </div>

        {/* Auto-unlock progress */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#b0b0b0]">{t('progress')}</span>
            <span className="font-mono text-white">
              <Zap className="w-3 h-3 text-[#facc15] inline" /> {totalFameEarned.toLocaleString()} / {threshold.toLocaleString()}
            </span>
          </div>
          <div className="h-3 bg-[#1a0a2e] rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isAutoUnlocked
                  ? 'bg-gradient-to-r from-[#facc15] to-[#ff8c00]'
                  : 'bg-gradient-to-r from-[#facc15]/60 to-[#ff8c00]/60'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!isAutoUnlocked && (
            <p className="text-xs text-[#b0b0b0] mt-1.5">
              {t('needMore', { amount: (threshold - totalFameEarned).toLocaleString() })}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="bg-[#1a0a2e]/80 rounded-lg p-3 border border-white/5">
          <p className="text-sm text-[#b0b0b0]">{t('autoUnlockDescription')}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg p-3">
            <p className="text-[#ff4444] text-sm">{error}</p>
          </div>
        )}

        {/* Instant unlock for $ */}
        {!isAutoUnlocked && unlockFee > 0 && (
          <Button
            variant="gold"
            fullWidth
            onClick={handlePurchaseUnlock}
            loading={isPurchasing}
            disabled={isPurchasing}
          >
            <span className="flex items-center gap-2">
              <DollarSign className="w-4 h-4" />
              {t('unlockNow', { cost: unlockFee.toLocaleString() })}
            </span>
          </Button>
        )}
      </div>
    </Modal>
  );
}
