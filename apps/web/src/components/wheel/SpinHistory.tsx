'use client';

import { motion } from 'framer-motion';
import { History, Trophy, TrendingUp, TrendingDown } from 'lucide-react';
import type { WheelHistoryItem } from '@/lib/api';

interface SpinHistoryProps {
  items: WheelHistoryItem[];
  isLoading: boolean;
}

export function SpinHistory({ items, isLoading }: SpinHistoryProps) {
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="bg-white/5 rounded-xl p-4">
        <div className="flex items-center gap-2 mb-4">
          <History className="w-4 h-4 text-white/60" />
          <span className="text-sm font-medium text-white/60">Recent Spins</span>
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="h-12 bg-white/5 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="bg-white/5 rounded-xl p-4 text-center">
        <History className="w-8 h-8 text-white/30 mx-auto mb-2" />
        <p className="text-sm text-white/50">No spins yet</p>
        <p className="text-xs text-white/30 mt-1">Your spin history will appear here</p>
      </div>
    );
  }

  return (
    <div className="bg-white/5 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-white/60" />
        <span className="text-sm font-medium text-white/60">Recent Spins</span>
      </div>

      <div className="space-y-2 max-h-[200px] overflow-y-auto">
        {items.map((item, index) => {
          const isWin = item.netResult > 0;

          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
              className={`
                flex items-center justify-between
                p-3 rounded-lg
                ${
                  item.jackpotWon
                    ? 'bg-[#ffd700]/10 border border-[#ffd700]/30'
                    : 'bg-white/5'
                }
              `}
            >
              <div className="flex items-center gap-3">
                {/* Win/Loss indicator */}
                <div
                  className={`
                    w-8 h-8 rounded-full flex items-center justify-center
                    ${
                      item.jackpotWon
                        ? 'bg-[#ffd700]/20'
                        : isWin
                          ? 'bg-[#22c55e]/20'
                          : 'bg-[#ef4444]/20'
                    }
                  `}
                >
                  {item.jackpotWon ? (
                    <Trophy className="w-4 h-4 text-[#ffd700]" />
                  ) : isWin ? (
                    <TrendingUp className="w-4 h-4 text-[#22c55e]" />
                  ) : (
                    <TrendingDown className="w-4 h-4 text-[#ef4444]" />
                  )}
                </div>

                {/* Details */}
                <div>
                  <div className="text-sm text-white">
                    x{item.betMultiplier} Bet
                    {item.jackpotWon && (
                      <span className="ml-2 text-xs text-[#ffd700] font-semibold">
                        JACKPOT!
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-white/50">
                    {formatDate(item.createdAt)}
                  </div>
                </div>
              </div>

              {/* Result */}
              <div className="text-right">
                <div
                  className={`text-sm font-semibold ${
                    item.jackpotWon
                      ? 'text-[#ffd700]'
                      : isWin
                        ? 'text-[#22c55e]'
                        : 'text-[#ef4444]'
                  }`}
                >
                  {item.netResult >= 0 ? '+' : ''}${item.netResult.toFixed(2)}
                </div>
                <div className="text-xs text-white/40">
                  Bet: ${item.totalBet.toFixed(2)}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
