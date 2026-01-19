'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { X, Trophy, Flame, Sparkles, Gift } from 'lucide-react';
import type { WheelSpinResponse } from '@/lib/api';
import { Modal } from '@/components/ui/Modal';

interface SpinResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  result: WheelSpinResponse | null;
}

const CONFETTI_COLORS = ['#ff2d95', '#9333ea', '#ffd700', '#22c55e', '#3b82f6'];

// Confetti particle component with pre-generated random values
function ConfettiParticle({
  delay,
  color,
  x,
  y,
  rotate
}: {
  delay: number;
  color: string;
  x: number;
  y: number;
  rotate: number;
}) {
  return (
    <motion.div
      className="absolute w-2 h-2 rounded-sm"
      style={{ backgroundColor: color }}
      initial={{
        x: '50%',
        y: '50%',
        opacity: 0,
        scale: 0,
        rotate: 0,
      }}
      animate={{
        x: `${x}%`,
        y: `${y}%`,
        opacity: [0, 1, 1, 0],
        scale: [0, 1, 1, 0.5],
        rotate,
      }}
      transition={{
        duration: 2,
        delay,
        ease: 'easeOut',
      }}
    />
  );
}

export function SpinResultModal({
  isOpen,
  onClose,
  result,
}: SpinResultModalProps) {
  const [showConfetti, setShowConfetti] = useState(false);

  // Generate random values once for confetti particles using lazy initialization
  const [confettiParticles] = useState(() =>
    Array.from({ length: 50 }, () => ({
      delay: Math.random() * 0.5,
      color: CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)],
      x: Math.random() * 100,
      y: Math.random() * 100,
      rotate: Math.random() * 720,
    }))
  );

  // Trigger confetti for big wins
  useEffect(() => {
    if (result && (result.jackpotWon || result.netResult > result.totalBet * 2)) {
      // Use setTimeout to avoid synchronous setState in effect
      const showTimer = setTimeout(() => setShowConfetti(true), 0);
      const hideTimer = setTimeout(() => setShowConfetti(false), 3000);
      return () => {
        clearTimeout(showTimer);
        clearTimeout(hideTimer);
        setShowConfetti(false);
      };
    }
  }, [result]);

  if (!result) return null;

  const isWin = result.netResult > 0;
  const isBigWin = result.netResult > result.totalBet * 3;

  // Group results by sector
  const resultSummary = result.results.reduce(
    (acc, r) => {
      acc[r.sector] = (acc[r.sector] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <div className="relative overflow-hidden">
        {/* Confetti overlay for big wins */}
        {showConfetti && (
          <div className="absolute inset-0 pointer-events-none overflow-hidden z-50">
            {confettiParticles.map((particle, i) => (
              <ConfettiParticle
                key={i}
                delay={particle.delay}
                color={particle.color}
                x={particle.x}
                y={particle.y}
                rotate={particle.rotate}
              />
            ))}
          </div>
        )}

        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white">Spin Result</h2>
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-white/10 transition-colors"
            >
              <X className="w-5 h-5 text-white/60" />
            </button>
          </div>

          {/* Jackpot announcement */}
          {result.jackpotWon && (
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="
                mb-6 p-4 rounded-xl
                bg-gradient-to-r from-[#ffd700]/30 to-[#ff8c00]/30
                border-2 border-[#ffd700]
                text-center
              "
            >
              <Trophy className="w-12 h-12 text-[#ffd700] mx-auto mb-2" />
              <div className="text-2xl font-bold text-[#ffd700]">JACKPOT!</div>
              <div className="text-3xl font-bold text-white mt-1">
                +${result.jackpotAmount.toFixed(2)}
              </div>
            </motion.div>
          )}

          {/* Main result */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className={`
              p-6 rounded-xl text-center mb-6
              ${
                result.jackpotWon
                  ? 'bg-gradient-to-br from-[#ffd700]/20 to-[#ff8c00]/20'
                  : isWin
                    ? 'bg-gradient-to-br from-[#22c55e]/20 to-[#16a34a]/20'
                    : 'bg-gradient-to-br from-[#ef4444]/20 to-[#dc2626]/20'
              }
            `}
          >
            <div className="flex items-center justify-center gap-2 mb-2">
              {result.jackpotWon ? (
                <Trophy className="w-6 h-6 text-[#ffd700]" />
              ) : isWin ? (
                <Sparkles className="w-6 h-6 text-[#22c55e]" />
              ) : (
                <Flame className="w-6 h-6 text-[#ef4444]" />
              )}
              <span
                className={`text-sm font-semibold ${
                  result.jackpotWon
                    ? 'text-[#ffd700]'
                    : isWin
                      ? 'text-[#22c55e]'
                      : 'text-[#ef4444]'
                }`}
              >
                {result.jackpotWon ? 'JACKPOT WIN!' : isBigWin ? 'BIG WIN!' : isWin ? 'WIN!' : 'TRY AGAIN'}
              </span>
            </div>

            <div
              className={`text-4xl font-bold ${
                result.jackpotWon
                  ? 'text-[#ffd700]'
                  : isWin
                    ? 'text-[#22c55e]'
                    : 'text-[#ef4444]'
              }`}
            >
              {result.netResult >= 0 ? '+' : ''}${result.netResult.toFixed(2)}
            </div>

            <div className="text-sm text-white/60 mt-2">
              {result.spinCount} spin{result.spinCount > 1 ? 's' : ''} | Bet: ${result.totalBet.toFixed(2)} | Payout: ${result.totalPayout.toFixed(2)}
            </div>
          </motion.div>

          {/* Results breakdown for multi-spin */}
          {result.spinCount > 1 && (
            <div className="mb-6">
              <div className="text-sm font-medium text-white/70 mb-2">Results:</div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(resultSummary).map(([sector, count]) => (
                  <div
                    key={sector}
                    className="
                      flex items-center gap-1 px-2 py-1
                      bg-white/10 rounded-lg text-sm
                    "
                  >
                    <span className="text-white/60">{count}x</span>
                    <span className="text-white font-medium">
                      {sector === 'jackpot' ? 'JACKPOT' : sector === 'empty' ? 'Empty' : sector.toUpperCase()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Free spins used */}
          {result.freeSpinsUsed > 0 && (
            <div className="flex items-center justify-center gap-2 text-sm text-[#22c55e] mb-4">
              <Gift className="w-4 h-4" />
              <span>Used {result.freeSpinsUsed} free spin{result.freeSpinsUsed > 1 ? 's' : ''}</span>
            </div>
          )}

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-white/50">New Balance</div>
              <div className="text-white font-semibold">${result.newBalance.toFixed(2)}</div>
            </div>
            <div className="bg-white/5 rounded-lg p-3">
              <div className="text-white/50">Free Spins Left</div>
              <div className="text-white font-semibold">{result.freeSpinsRemaining}</div>
            </div>
          </div>

          {/* Burn info */}
          {result.burnAmount > 0 && (
            <div className="mt-4 text-center text-xs text-white/40">
              <Flame className="w-3 h-3 inline-block mr-1" />
              ${result.burnAmount.toFixed(2)} burned | ${result.poolAmount.toFixed(2)} to jackpot
            </div>
          )}

          {/* Close button */}
          <button
            onClick={onClose}
            className="
              w-full mt-6 py-3 rounded-xl
              bg-gradient-to-r from-[#ff2d95] to-[#9333ea]
              text-white font-semibold
              hover:shadow-[0_0_20px_rgba(255,45,149,0.5)]
              transition-shadow
            "
          >
            Continue
          </button>
        </div>
      </div>
    </Modal>
  );
}
