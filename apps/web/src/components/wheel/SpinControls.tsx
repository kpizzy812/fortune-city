'use client';

import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Gift } from 'lucide-react';
import type { WheelMultiplier } from '@/lib/api';
import { useFeedback } from '@/hooks/useFeedback';

interface SpinControlsProps {
  betAmount: number;
  multipliers: number[];
  freeSpins: number;
  balance: number;
  isSpinning: boolean;
  onSpin: (multiplier: WheelMultiplier) => void;
}

export function SpinControls({
  betAmount,
  multipliers,
  freeSpins,
  balance,
  isSpinning,
  onSpin,
}: SpinControlsProps) {
  const { click: fbClick } = useFeedback();
  const [currentMultiplierIndex, setCurrentMultiplierIndex] = useState(0);
  const currentMultiplier = multipliers[currentMultiplierIndex] || 1;

  // Cycle through multipliers
  const cycleMultiplier = useCallback(() => {
    if (isSpinning) return;
    fbClick();
    setCurrentMultiplierIndex((prev) => (prev + 1) % multipliers.length);
  }, [isSpinning, multipliers.length, fbClick]);

  const totalCost = betAmount * currentMultiplier;
  const freeSpinsUsed = Math.min(freeSpins, currentMultiplier);
  const actualCost = totalCost - freeSpinsUsed * betAmount;
  const affordable = balance >= actualCost;
  const isFree = freeSpinsUsed >= currentMultiplier;

  const handleSpin = () => {
    if (!isSpinning && affordable) {
      onSpin(currentMultiplier as WheelMultiplier);
    }
  };

  return (
    <div className="space-y-4">
      {/* Free spins indicator */}
      {freeSpins > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="
            flex items-center justify-center gap-2
            bg-gradient-to-r from-[#22c55e]/20 to-[#16a34a]/20
            border border-[#22c55e]/50
            rounded-lg px-4 py-2
          "
        >
          <Gift className="w-4 h-4 text-[#22c55e]" />
          <span className="text-sm text-[#22c55e] font-medium">
            {freeSpins} Free Spin{freeSpins > 1 ? 's' : ''} Available!
          </span>
        </motion.div>
      )}

      {/* Main spin button with multiplier toggle */}
      <div className="flex items-center justify-center gap-0">
        {/* Main SPIN button */}
        <motion.button
          onClick={handleSpin}
          disabled={isSpinning || !affordable}
          whileHover={affordable && !isSpinning ? { scale: 1.02 } : {}}
          whileTap={affordable && !isSpinning ? { scale: 0.98 } : {}}
          className={`
            relative flex flex-col items-center justify-center
            w-48 h-16 rounded-l-2xl
            transition-all duration-200
            ${
              affordable && !isSpinning
                ? 'bg-gradient-to-br from-[#ff2d95] to-[#9333ea] hover:shadow-[0_0_30px_rgba(255,45,149,0.5)]'
                : 'bg-[#2a2a2a] opacity-50 cursor-not-allowed'
            }
          `}
        >
          {isSpinning ? (
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              <span className="text-lg font-bold text-white">SPINNING...</span>
            </div>
          ) : (
            <>
              <span className="text-2xl font-bold text-white tracking-wider">SPIN</span>
              <span className="text-xs text-white/70 mt-0.5">
                {isFree ? (
                  <span className="text-[#22c55e] font-medium">FREE!</span>
                ) : (
                  `$${actualCost.toFixed(2)}`
                )}
              </span>
            </>
          )}
        </motion.button>

        {/* Multiplier toggle button */}
        <motion.button
          onClick={cycleMultiplier}
          disabled={isSpinning}
          whileHover={!isSpinning ? { scale: 1.05 } : {}}
          whileTap={!isSpinning ? { scale: 0.95 } : {}}
          className={`
            relative flex flex-col items-center justify-center
            w-16 h-16 rounded-r-2xl
            border-l-2 border-[#1a0a2e]
            transition-all duration-200
            ${
              !isSpinning
                ? 'bg-gradient-to-br from-[#9333ea] to-[#7c3aed] hover:from-[#a855f7] hover:to-[#8b5cf6]'
                : 'bg-[#2a2a2a] opacity-50 cursor-not-allowed'
            }
          `}
        >
          <AnimatePresence mode="wait">
            <motion.span
              key={currentMultiplier}
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -10, opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-xl font-bold text-white"
            >
              x{currentMultiplier}
            </motion.span>
          </AnimatePresence>

          {/* Free spin indicator on multiplier */}
          {freeSpinsUsed > 0 && (
            <span className="text-[8px] text-[#22c55e] font-medium">
              {freeSpinsUsed} free
            </span>
          )}
        </motion.button>
      </div>

      {/* Bet info */}
      <div className="text-center text-xs text-white/50">
        Bet: ${(betAmount * currentMultiplier).toFixed(2)}
      </div>
    </div>
  );
}
