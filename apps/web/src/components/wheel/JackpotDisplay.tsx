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
        rounded-2xl p-4
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
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#ffd700]" />
            <span className="text-sm font-semibold text-[#ffd700]">JACKPOT</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 text-xs text-[#ffd700]/70">
              <Sparkles className="w-3 h-3" />
              <span>Won {timesWon}x</span>
            </div>
            {/* Info tooltip trigger */}
            <button
              onClick={() => setShowTooltip(!showTooltip)}
              className="p-0.5 rounded-full hover:bg-[#ffd700]/10 transition-colors"
            >
              <Info className="w-3.5 h-3.5 text-[#ffd700]/50" />
            </button>
          </div>
        </div>

        {/* Amount */}
        <motion.div
          className="text-center mb-1"
          animate={isAnimating ? { scale: [1, 1.05, 1] } : {}}
        >
          <span className="text-3xl font-bold text-[#ffd700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
            ${displayAmount.toFixed(2)}
          </span>
        </motion.div>

        {/* Tooltip */}
        <AnimatePresence>
          {showTooltip && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-3 bg-[#1a0a2e]/80 rounded-lg text-xs text-white/70 space-y-1">
                <p>Part of each losing spin goes to the jackpot pool.</p>
                <p>Hit the JACKPOT sector to win the entire pool!</p>
                <p className="text-[#ffd700]/60">Chance: 1% per spin</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Last winner */}
        <AnimatePresence>
          {lastWinner && lastWinner.amount && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mt-2 text-center text-xs text-[#ffd700]/60"
            >
              Last win: ${lastWinner.amount.toFixed(2)}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
