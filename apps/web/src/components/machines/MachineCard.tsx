'use client';

import { motion } from 'framer-motion';
import { Clock } from 'lucide-react';
import type { Machine, MachineIncome } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { IncomeCounter } from './IncomeCounter';

interface MachineCardProps {
  machine: Machine;
  income: MachineIncome | null;
  onCollect: () => void;
  isCollecting: boolean;
}

// Format remaining time
function formatTimeRemaining(expiresAt: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return 'Expired';

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Format seconds to readable time
function formatSecondsToTime(seconds: number): string {
  if (seconds <= 0) return 'Ready!';

  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

// Calculate progress percentage
function calculateProgress(startedAt: string, expiresAt: string): number {
  const start = new Date(startedAt).getTime();
  const end = new Date(expiresAt).getTime();
  const now = Date.now();

  if (now >= end) return 100;
  if (now <= start) return 0;

  return ((now - start) / (end - start)) * 100;
}

export function MachineCard({
  machine,
  income,
  onCollect,
  isCollecting,
}: MachineCardProps) {
  const progress = calculateProgress(machine.startedAt, machine.expiresAt);
  const timeRemaining = formatTimeRemaining(machine.expiresAt);
  const isExpired = machine.status === 'expired';

  return (
    <motion.div
      whileHover={{ scale: 1.02, y: -4 }}
      whileTap={{ scale: 0.98 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={`
        bg-[#2a1a4e] rounded-xl p-4
        border transition-all duration-300
        relative overflow-hidden group
        ${
          income?.isFull
            ? 'border-[#00ff88]/50 shadow-[0_0_20px_rgba(0,255,136,0.2)]'
            : isExpired
              ? 'border-[#6b6b6b]/50 opacity-75'
              : 'border-[#ff2d95]/30 hover:border-[#ff2d95]/60 hover:shadow-[0_0_30px_rgba(255,45,149,0.15)]'
        }
      `}
    >
      {/* Subtle gradient overlay on hover */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/0 to-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <div className="flex items-center gap-2">
          <motion.span
            className="text-2xl"
            whileHover={{ rotate: [0, -10, 10, 0], scale: 1.1 }}
            transition={{ duration: 0.4 }}
          >
            {machine.tierInfo.emoji}
          </motion.span>
          <div>
            <h3 className="font-semibold text-white">{machine.tierInfo.name}</h3>
            <p className="text-xs text-[#b0b0b0]">Tier {machine.tier}</p>
          </div>
        </div>
        {isExpired && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs px-2 py-1 bg-[#ff4444]/20 text-[#ff4444] rounded-full"
          >
            Expired
          </motion.span>
        )}
        {income?.isFull && !isExpired && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: 1 }}
            transition={{ scale: { duration: 1.5, repeat: Infinity } }}
            className="text-xs px-2 py-1 bg-[#00ff88]/20 text-[#00ff88] rounded-full"
          >
            Ready!
          </motion.span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[#b0b0b0] mb-1">
          <span>Service Life</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <ProgressBar
          value={progress}
          max={100}
          variant={progress > 90 ? 'danger' : 'default'}
          size="sm"
        />
      </div>

      {/* Income display */}
      <div className="mb-3">
        {income ? (
          <IncomeCounter
            accumulated={income.accumulated}
            ratePerSecond={income.ratePerSecond}
            coinBoxCapacity={income.coinBoxCapacity}
            isFull={income.isFull}
            size="md"
          />
        ) : (
          <div className="text-[#b0b0b0]">Loading...</div>
        )}
      </div>

      {/* Time remaining */}
      <div className="flex items-center gap-1 text-sm text-[#b0b0b0] mb-4">
        <Clock className="w-4 h-4" />
        <span>{timeRemaining} remaining</span>
      </div>

      {/* Collect button or timer - fixed height container */}
      <div className="min-h-[96px] flex flex-col justify-center">
        {income?.isFull || isExpired ? (
          <Button
            variant="gold"
            size="md"
            fullWidth
            loading={isCollecting}
            onClick={onCollect}
          >
            {isCollecting ? 'Collecting...' : `Collect $${income?.accumulated.toFixed(2) || '0.00'}`}
          </Button>
        ) : (
          <div className="bg-[#1a0a2e] rounded-lg p-3 text-center border border-[#00d4ff]/20">
            <p className="text-[10px] text-[#b0b0b0] uppercase tracking-wider mb-1">Full in</p>
            <p className="text-lg font-bold text-[#00d4ff] font-mono">
              {income ? formatSecondsToTime(income.secondsUntilFull) : '--:--'}
            </p>
            <div className="mt-2 h-1.5 bg-[#2a1a4e] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#00d4ff] to-[#00ff88] transition-all duration-1000"
                style={{ width: `${income ? (income.accumulated / income.coinBoxCapacity) * 100 : 0}%` }}
              />
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
