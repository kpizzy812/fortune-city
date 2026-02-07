'use client';

import { useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Zap, X, Flame } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useFameStore } from '@/stores/fame.store';
import { Button } from '@/components/ui/Button';

export function DailyLoginBanner() {
  const t = useTranslations('fame');
  const { token, user, refreshUser } = useAuthStore();
  const { claimDailyLogin, isClaiming, canClaimToday, fetchBalance } = useFameStore();
  const [dismissed, setDismissed] = useState(false);
  const [earned, setEarned] = useState<number | null>(null);

  // Fetch fame balance on mount to get accurate canClaimToday
  useEffect(() => {
    if (token) {
      fetchBalance(token);
    }
  }, [token, fetchBalance]);

  if (!token || !user || dismissed) return null;

  const canClaim = canClaimToday();

  // If already claimed today and no animation showing, hide
  if (!canClaim && earned === null) return null;

  const handleClaim = async () => {
    try {
      const result = await claimDailyLogin(token);
      setEarned(result.earned);
      // Update user data in auth store
      refreshUser();
      // Auto-dismiss after 3 seconds
      setTimeout(() => setDismissed(true), 3000);
    } catch {
      // Error is handled by fame store
    }
  };

  const streak = user.loginStreak ?? 0;

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="relative mb-4 bg-gradient-to-r from-[#2a1a4e] to-[#1a0a2e] border border-[#facc15]/30 rounded-xl p-3 overflow-hidden"
        >
          {/* Background glow */}
          <div className="absolute inset-0 bg-gradient-to-r from-[#facc15]/5 to-transparent" />

          <div className="relative flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#facc15]/20 to-[#facc15]/5 flex items-center justify-center border border-[#facc15]/20 shrink-0">
                <Zap className="w-5 h-5 text-[#facc15]" />
              </div>
              <div className="min-w-0">
                {earned !== null ? (
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                  >
                    <p className="text-sm font-bold text-[#facc15]">
                      +{earned} {t('famePoints')}
                    </p>
                    <p className="text-xs text-[#b0b0b0]">{t('claimedToday')}</p>
                  </motion.div>
                ) : (
                  <>
                    <p className="text-sm font-medium text-white truncate">
                      {t('dailyLoginTitle')}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-[#b0b0b0]">
                      <span>{t('claimFame')}</span>
                      {streak > 0 && (
                        <span className="flex items-center gap-0.5 text-[#ff8c00]">
                          <Flame className="w-3 h-3" />
                          {t('streak', { days: streak })}
                        </span>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              {earned === null && (
                <Button
                  variant="gold"
                  size="sm"
                  onClick={handleClaim}
                  loading={isClaiming}
                  disabled={isClaiming}
                >
                  {t('claim')}
                </Button>
              )}
              <button
                onClick={() => setDismissed(true)}
                className="text-[#6b6b6b] hover:text-white transition p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
