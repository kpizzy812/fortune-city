'use client';

import { useTranslations } from 'next-intl';
import { Zap, Lock, Unlock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/auth.store';
import { useFameStore } from '@/stores/fame.store';
import { FAME_UNLOCK_COST_BY_TIER } from '@fortune-city/shared';

interface UnlockTierModalProps {
  isOpen: boolean;
  onClose: () => void;
  tier: number;
}

export function UnlockTierModal({ isOpen, onClose, tier }: UnlockTierModalProps) {
  const t = useTranslations('fame');
  const { token, user, refreshUser } = useAuthStore();
  const { unlockTier, isUnlocking, error, clearError } = useFameStore();

  const cost = FAME_UNLOCK_COST_BY_TIER[tier] ?? 0;
  const currentFame = user?.fame ?? 0;
  const canUnlock = currentFame >= cost;
  const progress = cost > 0 ? Math.min((currentFame / cost) * 100, 100) : 0;

  const handleUnlock = async () => {
    if (!token || !canUnlock) return;
    try {
      await unlockTier(token, tier);
      refreshUser();
      onClose();
    } catch {
      // Error handled by store
    }
  };

  const handleClose = () => {
    clearError();
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={t('unlockTierTitle', { tier })}>
      <div className="space-y-5">
        {/* Tier icon */}
        <div className="flex justify-center">
          <div className={`
            w-20 h-20 rounded-2xl flex items-center justify-center
            ${canUnlock
              ? 'bg-gradient-to-br from-[#facc15]/20 to-[#facc15]/5 border border-[#facc15]/30'
              : 'bg-gradient-to-br from-[#6b6b6b]/20 to-[#6b6b6b]/5 border border-[#6b6b6b]/30'}
          `}>
            {canUnlock
              ? <Unlock className="w-10 h-10 text-[#facc15]" />
              : <Lock className="w-10 h-10 text-[#6b6b6b]" />}
          </div>
        </div>

        {/* Progress bar */}
        <div>
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-[#b0b0b0]">{t('progress')}</span>
            <span className="font-mono text-white">
              <Zap className="w-3 h-3 text-[#facc15] inline" /> {currentFame.toLocaleString()} / {cost.toLocaleString()}
            </span>
          </div>
          <div className="h-3 bg-[#1a0a2e] rounded-full overflow-hidden border border-white/5">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                canUnlock
                  ? 'bg-gradient-to-r from-[#facc15] to-[#ff8c00]'
                  : 'bg-gradient-to-r from-[#facc15]/60 to-[#ff8c00]/60'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          {!canUnlock && (
            <p className="text-xs text-[#b0b0b0] mt-1.5">
              {t('needMore', { amount: (cost - currentFame).toLocaleString() })}
            </p>
          )}
        </div>

        {/* Info */}
        <div className="bg-[#1a0a2e]/80 rounded-lg p-3 border border-white/5">
          <p className="text-sm text-[#b0b0b0]">{t('unlockDescription')}</p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg p-3">
            <p className="text-[#ff4444] text-sm">{error}</p>
          </div>
        )}

        {/* Action */}
        <Button
          variant="gold"
          fullWidth
          onClick={handleUnlock}
          loading={isUnlocking}
          disabled={!canUnlock || isUnlocking}
        >
          {canUnlock ? (
            <span className="flex items-center gap-2">
              <Unlock className="w-4 h-4" />
              {t('unlockButton', { cost: cost.toLocaleString() })}
            </span>
          ) : (
            t('insufficientFame')
          )}
        </Button>
      </div>
    </Modal>
  );
}
