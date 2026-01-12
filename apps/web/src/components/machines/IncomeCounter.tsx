'use client';

import { motion } from 'framer-motion';
import { Coins } from 'lucide-react';

interface IncomeCounterProps {
  accumulated: number;
  ratePerSecond: number;
  coinBoxCapacity: number;
  isFull: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeStyles = {
  sm: 'text-lg',
  md: 'text-2xl',
  lg: 'text-3xl',
};

export function IncomeCounter({
  accumulated,
  isFull,
  size = 'md',
}: IncomeCounterProps) {
  return (
    <div className="flex items-center gap-2">
      {/* Coin icon */}
      <motion.div
        animate={
          isFull
            ? {
                scale: [1, 1.2, 1],
                rotate: [0, 10, -10, 0],
              }
            : {}
        }
        transition={{
          duration: 0.5,
          repeat: isFull ? Infinity : 0,
          repeatDelay: 1,
        }}
        className="text-[#ffd700]"
      >
        <Coins className="w-6 h-6" />
      </motion.div>

      {/* Amount */}
      <motion.span
        key={Math.floor(accumulated * 100)} // Animate on change
        initial={{ opacity: 0.8, y: -2 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
          font-mono font-bold
          ${sizeStyles[size]}
          ${isFull ? 'text-[#00ff88]' : 'text-[#ffd700]'}
        `}
      >
        ${accumulated.toFixed(2)}
      </motion.span>

      {/* Full indicator */}
      {isFull && (
        <motion.span
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="
            text-xs font-semibold px-2 py-0.5
            bg-[#00ff88]/20 text-[#00ff88]
            rounded-full border border-[#00ff88]/50
          "
        >
          FULL
        </motion.span>
      )}
    </div>
  );
}
