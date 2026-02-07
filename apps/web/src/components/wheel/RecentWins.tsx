'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, TrendingUp, Users } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api, type RecentWinItem } from '@/lib/api';

export function RecentWins() {
  const [items, setItems] = useState<RecentWinItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('wheel.recentWins');

  useEffect(() => {
    api
      .getWheelRecentWins(15)
      .then(setItems)
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  /** Add a new win to the top of the list (for realtime events) */
  const addWin = (win: RecentWinItem) => {
    setItems((prev) => [win, ...prev.slice(0, 14)]);
  };

  // Expose addWin for parent via ref would be overkill here —
  // we attach to it through the exported function if needed
  // For now, the component is self-contained with polling data.

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <Users className="w-4 h-4 text-white/60" />
          <span className="text-sm font-medium text-white/60">{t('title')}</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 bg-white/5 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl p-4 text-center">
        <Users className="w-8 h-8 text-white/30 mx-auto mb-2" />
        <p className="text-sm text-white/50">{t('noWinsYet')}</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-3">
        <Users className="w-4 h-4 text-[#ffd700]" />
        <span className="text-sm font-medium text-white/60">{t('title')}</span>
      </div>

      <div className="space-y-1.5 max-h-[200px] overflow-y-auto scrollbar-thin">
        <AnimatePresence initial={false}>
          {items.map((item, index) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.03, duration: 0.25 }}
              className={`
                flex items-center justify-between px-3 py-2 rounded-lg
                ${item.isJackpot
                  ? 'bg-[#ffd700]/10 border border-[#ffd700]/30'
                  : 'bg-white/[0.03] hover:bg-white/[0.06]'
                }
              `}
            >
              {/* Left: icon + username + time */}
              <div className="flex items-center gap-2 min-w-0">
                <div
                  className={`
                    w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0
                    ${item.isJackpot ? 'bg-[#ffd700]/20' : 'bg-[#22c55e]/15'}
                  `}
                >
                  {item.isJackpot ? (
                    <Trophy className="w-3 h-3 text-[#ffd700]" />
                  ) : (
                    <TrendingUp className="w-3 h-3 text-[#22c55e]" />
                  )}
                </div>
                <span className="text-xs text-white/60 truncate">{item.username}</span>
                <span className="text-[10px] text-white/30 flex-shrink-0">
                  {formatTimeAgo(item.createdAt)}
                </span>
              </div>

              {/* Right: amount + multiplier */}
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {item.isJackpot && (
                  <span className="text-[10px] font-bold text-[#ffd700] uppercase">
                    {t('jackpot')}
                  </span>
                )}
                <span
                  className={`text-xs font-mono font-semibold ${
                    item.isJackpot ? 'text-[#ffd700]' : 'text-[#22c55e]'
                  }`}
                >
                  +${item.isJackpot ? item.jackpotAmount.toFixed(2) : item.payout.toFixed(2)}
                </span>
                {item.multiplier && !item.isJackpot && (
                  <span className="text-[10px] text-white/40">
                    ({item.multiplier})
                  </span>
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
