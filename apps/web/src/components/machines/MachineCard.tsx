'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Clock, Zap } from 'lucide-react';
import type { Machine, MachineIncome } from '@/types';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/Button';
import { IncomeCounter } from './IncomeCounter';

interface MachineCardProps {
  machine: Machine;
  income: MachineIncome | null;
  onCollect: () => void;
  onRiskyCollect?: () => void;
  onAutoCollectClick?: () => void;
  onOverclockClick?: () => void;
  isCollecting: boolean;
}

// Format remaining time
function formatTimeRemaining(expiresAt: string, expiredLabel: string): string {
  const now = new Date();
  const expires = new Date(expiresAt);
  const diffMs = expires.getTime() - now.getTime();

  if (diffMs <= 0) return expiredLabel;

  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) {
    return `${days}d ${hours}h`;
  }
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${hours}h ${minutes}m`;
}

// Format seconds to readable time
function formatSecondsToTime(seconds: number, readyLabel: string): string {
  if (seconds <= 0) return readyLabel;

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
  onRiskyCollect,
  onAutoCollectClick,
  onOverclockClick,
  isCollecting,
}: MachineCardProps) {
  const t = useTranslations('machines');
  const tCommon = useTranslations('common');
  const [isImageExpanded, setIsImageExpanded] = useState(false);

  const progress = calculateProgress(machine.startedAt, machine.expiresAt);
  const timeRemaining = formatTimeRemaining(machine.expiresAt, tCommon('expired'));
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

      {/* Square image - hover on desktop, tap toggle on mobile */}
      <div className="flex justify-center mb-4">
        <motion.div
          className={`
            relative rounded-2xl overflow-hidden cursor-pointer aspect-square
            bg-gradient-to-br
            ${machine.tier <= 3 ? 'from-[#ff2d95]/30 to-[#00d4ff]/30' :
              machine.tier <= 6 ? 'from-[#ffd700]/30 to-[#ff8c00]/30' :
              'from-[#00ff88]/30 to-[#00d4ff]/30'}
          `}
          initial={false}
          animate={{ width: isImageExpanded ? '100%' : 120 }}
          whileHover={{ width: '100%' }}
          onClick={() => setIsImageExpanded(!isImageExpanded)}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        >
          <div className="absolute inset-0 flex items-center justify-center p-2">
            <motion.div
              className="relative w-full h-full"
              animate={isImageExpanded ? { scale: 1.05 } : { scale: 1 }}
              whileHover={{ scale: 1.05 }}
              transition={{ duration: 0.3 }}
            >
              <Image
                src={machine.tierInfo.imageUrl}
                alt={machine.tierInfo.name}
                fill
                className="object-contain drop-shadow-lg"
                sizes="(max-width: 768px) 120px, 200px"
              />
            </motion.div>
          </div>
          <div className="absolute top-2 right-2">
            <span className={`
              px-2 py-0.5 rounded-full text-[9px] font-bold
              ${machine.tier <= 3 ? 'bg-[#ff2d95]/70 text-white' :
                machine.tier <= 6 ? 'bg-[#ffd700]/70 text-white' :
                'bg-[#00ff88]/70 text-white'}
            `}>
              T{machine.tier}
            </span>
          </div>
        </motion.div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between mb-3 relative">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-white">{machine.tierInfo.name}</h3>
            {machine.autoCollectEnabled && !isExpired && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[10px] px-1.5 py-0.5 bg-[#00ff88]/20 text-[#00ff88] rounded flex items-center gap-0.5"
              >
                <Zap className="w-2.5 h-2.5" />
                {t('auto')}
              </motion.span>
            )}
            {Number(machine.overclockMultiplier) > 0 && !isExpired && (
              <motion.span
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-[10px] px-1.5 py-0.5 bg-[#ff2d95]/20 text-[#ff2d95] rounded font-bold"
              >
                x{Number(machine.overclockMultiplier)}
              </motion.span>
            )}
          </div>
        </div>
        {isExpired && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-xs px-2 py-1 bg-[#ff4444]/20 text-[#ff4444] rounded-full"
          >
            {tCommon('expired')}
          </motion.span>
        )}
        {income?.isFull && !isExpired && (
          <motion.span
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: [1, 1.05, 1], opacity: 1 }}
            transition={{ scale: { duration: 1.5, repeat: Infinity } }}
            className="text-xs px-2 py-1 bg-[#00ff88]/20 text-[#00ff88] rounded-full"
          >
            {t('ready')}
          </motion.span>
        )}
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between text-xs text-[#b0b0b0] mb-1">
          <span>{t('wear')}</span>
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
          <div className="text-[#b0b0b0]">{tCommon('loading')}</div>
        )}
      </div>

      {/* Time remaining */}
      <div className="flex items-center gap-1 text-sm text-[#b0b0b0] mb-4">
        <Clock className="w-4 h-4" />
        <span>{timeRemaining}</span>
      </div>

      {/* Collect button or timer - fixed height container */}
      <div className="min-h-[96px] flex flex-col justify-center">
        {income?.isFull || isExpired ? (
          <div className="flex gap-2">
            <Button
              variant="gold"
              size="md"
              fullWidth
              loading={isCollecting}
              onClick={onCollect}
            >
              {isCollecting ? tCommon('processing') : `Collect $${income?.accumulated.toFixed(2) || '0.00'}`}
            </Button>
            {income?.isFull && !isExpired && onRiskyCollect && (
              <Button
                variant="primary"
                size="md"
                loading={isCollecting}
                onClick={onRiskyCollect}
                className="whitespace-nowrap px-4"
              >
                {t('riskIt')}
              </Button>
            )}
          </div>
        ) : (
          <div className="bg-[#1a0a2e] rounded-lg p-3 text-center border border-[#00d4ff]/20">
            <p className="text-[10px] text-[#b0b0b0] uppercase tracking-wider mb-1">{t('fullIn')}</p>
            <p className="text-lg font-bold text-[#00d4ff] font-mono">
              {income ? formatSecondsToTime(income.secondsUntilFull, t('ready')) : '--:--'}
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

      {/* Action buttons: Auto Collect + Overclock */}
      {!isExpired && (onAutoCollectClick || onOverclockClick) && (
        <div className="mt-3 pt-3 border-t border-[#ff2d95]/20 flex items-center gap-3">
          {onAutoCollectClick && (
            <button
              onClick={onAutoCollectClick}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[#00ff88] hover:text-[#00d4ff] transition-colors group"
            >
              <Zap className="w-3.5 h-3.5 group-hover:animate-pulse" />
              <span>{machine.autoCollectEnabled ? t('collectorActive') : t('hireCollector')}</span>
            </button>
          )}
          {onOverclockClick && (
            <button
              onClick={onOverclockClick}
              className="flex-1 flex items-center justify-center gap-1.5 text-xs text-[#ff2d95] hover:text-[#ffd700] transition-colors group"
            >
              <span className="group-hover:animate-pulse">⚡</span>
              <span>{Number(machine.overclockMultiplier) > 0 ? t('boostActive') : t('boost')}</span>
            </button>
          )}
        </div>
      )}
    </motion.div>
  );
}
