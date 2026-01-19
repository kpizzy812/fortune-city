'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Gamepad2, Sparkles } from 'lucide-react';
import type { Machine, MachineIncome } from '@/types';
import { MachineCard } from './MachineCard';
import { MachineCardSkeleton } from './MachineCardSkeleton';
import { Button } from '@/components/ui/Button';

interface MachineGridProps {
  machines: Machine[];
  incomes: Record<string, MachineIncome>;
  onCollect: (machineId: string) => void;
  onRiskyCollect?: (machineId: string) => void;
  onAutoCollectClick?: (machineId: string) => void;
  isCollecting: Record<string, boolean>;
  isLoading?: boolean;
}

export function MachineGrid({
  machines,
  incomes,
  onCollect,
  onRiskyCollect,
  onAutoCollectClick,
  isCollecting,
  isLoading = false,
}: MachineGridProps) {
  const t = useTranslations('machines');

  // Loading state with skeletons
  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <MachineCardSkeleton key={i} />
        ))}
      </div>
    );
  }

  // Empty state
  if (machines.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="
          flex flex-col items-center justify-center py-12 lg:py-16
          bg-gradient-to-b from-[#2a1a4e] to-[#1a0a2e]
          rounded-xl border border-[#00d4ff]/30
          relative overflow-hidden
          max-h-[850px]:py-6
        "
      >
        {/* Background decoration */}
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-4 left-8 text-4xl animate-pulse">🎰</div>
          <div className="absolute top-12 right-12 text-3xl animate-pulse delay-100">💰</div>
          <div className="absolute bottom-8 left-16 text-3xl animate-pulse delay-200">🎲</div>
          <div className="absolute bottom-12 right-8 text-4xl animate-pulse delay-300">🍀</div>
        </div>

        <motion.div
          initial={{ scale: 0.8 }}
          animate={{ scale: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          className="relative z-10 max-h-[850px]:hidden"
        >
          <div className="relative">
            <Gamepad2 className="w-20 h-20 mb-4 text-[#00d4ff]" />
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
              className="absolute -top-2 -right-2"
            >
              <Sparkles className="w-6 h-6 text-[#ffd700]" />
            </motion.div>
          </div>
        </motion.div>

        <h3 className="text-2xl font-bold text-white mb-2 relative z-10 max-h-[850px]:text-xl max-h-[850px]:mb-1">{t('noMachinesYet')}</h3>
        <p className="text-[#b0b0b0] text-center mb-6 max-w-xs relative z-10 max-h-[850px]:mb-4 max-h-[850px]:text-sm">
          {t('buyFirstMachine')}
        </p>

        <Link href="/shop" className="relative z-10">
          <Button variant="primary" size="lg" className="group">
            <span className="flex items-center gap-2">
              {t('visitShop')}
              <motion.span
                animate={{ x: [0, 4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                →
              </motion.span>
            </span>
          </Button>
        </Link>
      </motion.div>
    );
  }

  // Machines grid
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {machines.map((machine, index) => (
        <motion.div
          key={machine.id}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.1 }}
        >
          <MachineCard
            machine={machine}
            income={incomes[machine.id] || null}
            onCollect={() => onCollect(machine.id)}
            onRiskyCollect={onRiskyCollect ? () => onRiskyCollect(machine.id) : undefined}
            onAutoCollectClick={onAutoCollectClick ? () => onAutoCollectClick(machine.id) : undefined}
            isCollecting={isCollecting[machine.id] || false}
          />
        </motion.div>
      ))}
    </div>
  );
}
