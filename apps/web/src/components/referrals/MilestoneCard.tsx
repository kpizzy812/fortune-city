'use client';

import { useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Lock, Check, Gift, Percent, Crown, Cpu } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';
import { api, type MilestoneStatus } from '@/lib/api';
import { useFeedback } from '@/hooks/useFeedback';

const REWARD_ICONS: Record<string, typeof Gift> = {
  free_machine_tier1: Cpu,
  tax_discount_5: Percent,
  free_machine_tier2: Cpu,
  vip: Crown,
};

const REWARD_COLORS: Record<string, string> = {
  free_machine_tier1: '#ff2d95',
  tax_discount_5: '#00d4ff',
  free_machine_tier2: '#ffd700',
  vip: '#ffd700',
};

interface MilestoneCardProps {
  milestone: MilestoneStatus;
  activeReferrals: number;
  onClaimed: () => void;
}

export function MilestoneCard({
  milestone,
  activeReferrals,
  onClaimed,
}: MilestoneCardProps) {
  const [isClaiming, setIsClaiming] = useState(false);
  const { token } = useAuthStore();
  const { collect: fbCollect } = useFeedback();
  const t = useTranslations('refs.milestones');

  const Icon = REWARD_ICONS[milestone.reward] ?? Gift;
  const color = REWARD_COLORS[milestone.reward] ?? '#00d4ff';
  const progress = Math.min(activeReferrals / milestone.threshold, 1);
  const rewardKey = `reward_${milestone.reward}` as
    | 'reward_free_machine_tier1'
    | 'reward_tax_discount_5'
    | 'reward_free_machine_tier2'
    | 'reward_vip';

  const handleClaim = useCallback(async () => {
    if (!token || isClaiming) return;
    setIsClaiming(true);
    try {
      await api.claimReferralMilestone(token, milestone.milestone);
      fbCollect();
      onClaimed();
    } catch {
      // Error silently handled
    } finally {
      setIsClaiming(false);
    }
  }, [token, isClaiming, milestone.milestone, onClaimed, fbCollect]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`
        relative bg-[#1a0a2e] rounded-lg p-3 border transition-colors
        ${milestone.claimed
          ? 'border-[#00ff88]/30'
          : milestone.canClaim
            ? 'border-[#ffd700]/50'
            : 'border-white/10'
        }
      `}
    >
      <div className="flex items-center gap-3">
        {/* Icon */}
        <div
          className={`
            w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0
            ${milestone.claimed ? 'bg-[#00ff88]/20' : `bg-[${color}]/15`}
          `}
          style={{
            backgroundColor: milestone.claimed
              ? 'rgba(0, 255, 136, 0.15)'
              : `${color}20`,
          }}
        >
          {milestone.claimed ? (
            <Check className="w-5 h-5 text-[#00ff88]" />
          ) : milestone.canClaim ? (
            <Gift className="w-5 h-5" style={{ color }} />
          ) : (
            <Lock className="w-4 h-4 text-white/30" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Icon className="w-3.5 h-3.5 flex-shrink-0" style={{ color }} />
            <span className="text-sm font-medium text-white truncate">
              {t(rewardKey)}
            </span>
          </div>
          <p className="text-xs text-white/40 mt-0.5">
            {t('threshold', { count: milestone.threshold })}
          </p>

          {/* Progress bar */}
          {!milestone.claimed && (
            <div className="mt-1.5 h-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${progress * 100}%`,
                  backgroundColor: milestone.canClaim ? '#ffd700' : color,
                }}
              />
            </div>
          )}
        </div>

        {/* Action */}
        <div className="flex-shrink-0">
          {milestone.claimed ? (
            <span className="text-xs text-[#00ff88] font-medium">
              {t('claimed')}
            </span>
          ) : milestone.canClaim ? (
            <button
              onClick={handleClaim}
              disabled={isClaiming}
              className="px-3 py-1.5 bg-[#ffd700]/20 border border-[#ffd700]/40 rounded-lg text-xs font-semibold text-[#ffd700] hover:bg-[#ffd700]/30 transition-colors disabled:opacity-50"
            >
              {isClaiming ? t('claiming') : t('claim')}
            </button>
          ) : (
            <span className="text-xs text-white/20">
              {activeReferrals}/{milestone.threshold}
            </span>
          )}
        </div>
      </div>
    </motion.div>
  );
}
