'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart, Banknote, Star, Trophy } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { api, type ActivityFeedItem } from '@/lib/api';

const TYPE_CONFIG: Record<
  ActivityFeedItem['type'],
  { icon: typeof Star; color: string; labelKey: string }
> = {
  machine_purchase: { icon: ShoppingCart, color: '#ff2d95', labelKey: 'purchased' },
  withdrawal: { icon: Banknote, color: '#22c55e', labelKey: 'withdrew' },
  wheel_win: { icon: Star, color: '#00d4ff', labelKey: 'won' },
  jackpot: { icon: Trophy, color: '#ffd700', labelKey: 'jackpot' },
};

export function ActivityFeed() {
  const [items, setItems] = useState<ActivityFeedItem[]>([]);
  const [visibleIndex, setVisibleIndex] = useState(0);
  const t = useTranslations('activity');

  useEffect(() => {
    api
      .getActivityFeed(20)
      .then(setItems)
      .catch(() => {});
  }, []);

  // Auto-cycle every 3 seconds
  useEffect(() => {
    if (items.length === 0) return;
    const interval = setInterval(() => {
      setVisibleIndex((prev) => (prev + 1) % items.length);
    }, 3000);
    return () => clearInterval(interval);
  }, [items.length]);

  if (items.length === 0) return null;

  const current = items[visibleIndex];
  const config = TYPE_CONFIG[current.type];
  const Icon = config.icon;

  return (
    <div className="bg-[#1a0a2e]/60 rounded-lg px-3 py-2 border border-[#ff2d95]/10 mb-4 overflow-hidden">
      <AnimatePresence mode="wait">
        <motion.div
          key={visibleIndex}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-2 text-xs"
        >
          <Icon
            className="w-3.5 h-3.5 flex-shrink-0"
            style={{ color: config.color }}
          />
          <span className="text-white/70 truncate">{current.username}</span>
          <span className="text-white/50 flex-shrink-0">{t(config.labelKey)}</span>
          <span
            className="font-mono font-semibold flex-shrink-0"
            style={{ color: config.color }}
          >
            ${current.amount.toFixed(2)}
          </span>
          {current.multiplier && (
            <span className="text-white/40 text-[10px] flex-shrink-0">
              {current.multiplier}
            </span>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
