'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Sparkles, Info } from 'lucide-react';

interface JackpotDisplayProps {
  currentPool: number;
  timesWon: number;
  lastWinner?: {
    userId: string;
    amount: number | null;
    wonAt: string | null;
  } | null;
}

export function JackpotDisplay({
  currentPool,
  timesWon,
  lastWinner,
}: JackpotDisplayProps) {
  const [displayAmount, setDisplayAmount] = useState(currentPool);
  const [isAnimating, setIsAnimating] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Animate pool changes
  useEffect(() => {
    if (currentPool !== displayAmount) {
      setIsAnimating(true);
      const diff = currentPool - displayAmount;
      const steps = 20;
      const stepValue = diff / steps;
      let current = displayAmount;
      let step = 0;

      const interval = setInterval(() => {
        step++;
        current += stepValue;
        setDisplayAmount(current);

        if (step >= steps) {
          setDisplayAmount(currentPool);
          setIsAnimating(false);
          clearInterval(interval);
        }
      }, 50);

      return () => clearInterval(interval);
    }
  }, [currentPool, displayAmount]);

  return (
    <div
      className="
        relative overflow-hidden
        bg-gradient-to-br from-[#ffd700]/20 to-[#ff8c00]/20
        border border-[#ffd700]/50
        rounded-xl px-3 py-2
        shadow-[0_0_30px_rgba(255,215,0,0.2)]
      "
    >
      {/* Animated sparkles background */}
      <div className="absolute inset-0 overflow-hidden">
        {[...Array(5)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-[#ffd700] rounded-full"
            initial={{ opacity: 0, x: Math.random() * 100 + '%', y: '100%' }}
            animate={{
              opacity: [0, 1, 0],
              y: '-100%',
              x: Math.random() * 100 + '%',
            }}
            transition={{
              duration: 2 + Math.random() * 2,
              repeat: Infinity,
              delay: Math.random() * 2,
            }}
          />
        ))}
      </div>

      <div className="relative z-10">
        {/* Header + Amount in one row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-[#ffd700]" />
            <span className="text-xs font-semibold text-[#ffd700]">JACKPOT</span>
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className="p-0.5 rounded-full hover:bg-[#ffd700]/10 transition-colors"
            >
              <Info className="w-3 h-3 text-[#ffd700]/50" />
            </button>
          </div>

          <motion.span
            className="text-xl font-bold text-[#ffd700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]"
            animate={isAnimating ? { scale: [1, 1.05, 1] } : {}}
          >
            ${displayAmount.toFixed(2)}
          </motion.span>

          <div className="flex items-center gap-1 text-xs text-[#ffd700]/70">
            <Sparkles className="w-3 h-3" />
            <span>{timesWon}x won</span>
          </div>
        </div>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-1.5 p-2 bg-[#1a0a2e]/80 rounded-lg text-xs text-white/70 space-y-0.5">
                <p>Part of each losing spin goes to the jackpot pool.</p>
                <p>Hit the JACKPOT sector to win the entire pool!</p>
                <p className="text-[#ffd700]/60">Chance: 1% per spin</p>
                {lastWinner?.amount && (
                  <p className="text-[#ffd700]/60">Last win: ${lastWinner.amount.toFixed(2)}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
