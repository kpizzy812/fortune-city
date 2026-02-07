'use client';

import { useState, useEffect, useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { Sparkles, Zap } from 'lucide-react';
import type { Machine, MachineIncome } from '@/types';

// Slot positions normalized as fractions of canvas dimensions
// Vertical canvas: 540×960, machine base size: 600×0.3 = 180px
const VERTICAL_SLOTS = [
  { x: 55 / 540, y: 189 / 960 },
  { x: 279 / 540, y: 191 / 960 },
  { x: 52 / 540, y: 448 / 960 },
  { x: 281 / 540, y: 445 / 960 },
  { x: 53 / 540, y: 703 / 960 },
  { x: 282 / 540, y: 705 / 960 },
];
const VERTICAL_MACHINE_W = 180 / 540;

// Horizontal canvas: 960×540, machine base size: 600×0.3 = 180px
const HORIZONTAL_SLOTS = [
  { x: 75 / 960, y: 126 / 540 },
  { x: 379 / 960, y: 128 / 540 },
  { x: 659 / 960, y: 125 / 540 },
  { x: 77 / 960, y: 329 / 540 },
  { x: 377 / 960, y: 326 / 540 },
  { x: 663 / 960, y: 324 / 540 },
];
const HORIZONTAL_MACHINE_W = 180 / 960;

const MAX_SLOTS = 6;

interface CasinoFloorProps {
  machines: Machine[];
  incomes: Record<string, MachineIncome>;
  onCollect: (machineId: string) => void;
  onRiskyCollect?: (machineId: string) => void;
  onAutoCollectClick?: (machineId: string) => void;
  onMachineClick?: (machineId: string) => void;
  isCollecting: Record<string, boolean>;
  isLoading?: boolean;
}

export function CasinoFloor({
  machines,
  incomes,
  onCollect,
  onRiskyCollect,
  onMachineClick,
  isCollecting,
  isLoading = false,
}: CasinoFloorProps) {
  const t = useTranslations('machines');
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const slots = isDesktop ? HORIZONTAL_SLOTS : VERTICAL_SLOTS;
  const machineW = isDesktop ? HORIZONTAL_MACHINE_W : VERTICAL_MACHINE_W;
  const bgSrc = isDesktop ? '/machines/horizontal.png' : '/machines/vertical.png';
  const aspectRatio = isDesktop ? '16 / 9' : '9 / 16';

  const activeMachines = useMemo(
    () => machines.filter(m => m.status === 'active' || m.status === 'expired').slice(0, MAX_SLOTS),
    [machines],
  );

  // Empty state — show floor with shop CTA
  if (!isLoading && activeMachines.length === 0) {
    return (
      <div className="relative w-full lg:rounded-xl overflow-hidden" style={{ aspectRatio }}>
        <Image src={bgSrc} alt="Casino floor" fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 960px" />
        <div className="absolute inset-0 flex flex-col items-center justify-start pt-[25%] lg:justify-center lg:pt-0 bg-black/40 backdrop-blur-[2px]">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
            <h3 className="text-xl font-bold text-white mb-2">{t('noMachinesYet')}</h3>
            <p className="text-sm text-white/70 mb-4">{t('buyFirstMachine')}</p>
            <Link
              href="/shop"
              className="inline-flex items-center gap-2 px-6 py-3 bg-[#ff2d95] text-white rounded-lg font-medium hover:bg-[#ff2d95]/80 transition"
            >
              {t('visitShop')}
              <motion.span animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>→</motion.span>
            </Link>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full lg:rounded-xl overflow-hidden" style={{ aspectRatio }}>
      {/* Background */}
      <Image src={bgSrc} alt="Casino floor" fill className="object-cover" priority sizes="(max-width: 1024px) 100vw, 960px" />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
        </div>
      )}

      {/* Machines placed in slots */}
      {activeMachines.map((machine, index) => {
        const slot = slots[index];
        if (!slot) return null;

        const income = incomes[machine.id];
        const isExpired = machine.status === 'expired';
        const isFull = income?.isFull || isExpired;
        const fillPercent = income
          ? Math.min(100, (income.accumulated / income.coinBoxCapacity) * 100)
          : 0;

        return (
          <div
            key={machine.id}
            className="absolute"
            style={{
              left: `${slot.x * 100}%`,
              top: `${slot.y * 100}%`,
              width: `${machineW * 100}%`,
            }}
          >
            {/* UI overlay above the machine */}
            <div className="absolute bottom-full left-0 right-0 mb-0.5 z-10">
              {/* Claim + Risk It buttons — only when coin box is full */}
              <AnimatePresence>
                {isFull && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    className="flex gap-1 justify-center mb-1"
                  >
                    <motion.button
                      animate={{ scale: [1, 1.08, 1] }}
                      transition={{ duration: 0.4, repeat: Infinity, repeatDelay: 2.5 }}
                      onClick={() => onCollect(machine.id)}
                      disabled={isCollecting[machine.id]}
                      className="px-2 py-0.5 bg-[#ffd700] text-black text-[10px] font-bold rounded shadow-[0_0_8px_rgba(255,215,0,0.5)] hover:bg-[#ffd700]/90 disabled:opacity-50 whitespace-nowrap"
                    >
                      {isCollecting[machine.id] ? '...' : `$${income?.accumulated.toFixed(2) ?? '0'}`}
                    </motion.button>
                    {!isExpired && onRiskyCollect && (
                      <motion.button
                        animate={{ rotate: [0, -3, 3, -3, 0] }}
                        transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 2.5 }}
                        onClick={() => onRiskyCollect(machine.id)}
                        disabled={isCollecting[machine.id]}
                        className="px-2 py-0.5 bg-[#ff2d95] text-white text-[10px] font-bold rounded shadow-[0_0_8px_rgba(255,45,149,0.5)] hover:bg-[#ff2d95]/90 disabled:opacity-50 whitespace-nowrap"
                      >
                        {t('riskIt')}
                      </motion.button>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Progress bar */}
              <div className="h-1.5 bg-black/60 rounded-full overflow-hidden mx-1">
                <motion.div
                  className={`h-full rounded-full ${
                    isFull ? 'bg-[#ffd700]' : 'bg-gradient-to-r from-[#00d4ff] to-[#00ff88]'
                  }`}
                  initial={false}
                  animate={{ width: `${fillPercent}%` }}
                  transition={{ duration: 1, ease: 'linear' }}
                />
              </div>
            </div>

            {/* Machine image — tap to view details */}
            <div
              className="relative w-full cursor-pointer"
              style={{ aspectRatio: '1' }}
              onClick={() => onMachineClick?.(machine.id)}
            >
              <Image
                src={machine.tierInfo.imageUrl}
                alt={machine.tierInfo.name}
                fill
                className="object-contain drop-shadow-[0_4px_8px_rgba(0,0,0,0.5)]"
                sizes="180px"
              />
              {/* Tier badge */}
              <span className={`
                absolute top-0 right-0 px-1 py-0.5 rounded text-[8px] font-bold shadow-sm
                ${machine.tier <= 3 ? 'bg-[#ff2d95]/80' :
                  machine.tier <= 6 ? 'bg-[#ffd700]/80' :
                  'bg-[#00ff88]/80'} text-white
              `}>
                T{machine.tier}
              </span>
              {/* Auto collect indicator */}
              {machine.autoCollectEnabled && (
                <span className="absolute bottom-0 right-0 p-0.5 bg-[#00ff88]/30 rounded">
                  <Zap className="w-2.5 h-2.5 text-[#00ff88]" />
                </span>
              )}
            </div>
          </div>
        );
      })}

      {/* Empty slot placeholders */}
      {!isLoading && Array.from({ length: Math.max(0, MAX_SLOTS - activeMachines.length) }).map((_, i) => {
        const slotIndex = activeMachines.length + i;
        const slot = slots[slotIndex];
        if (!slot) return null;
        return (
          <Link
            key={`empty-${slotIndex}`}
            href="/shop"
            className="absolute group"
            style={{
              left: `${slot.x * 100}%`,
              top: `${slot.y * 100}%`,
              width: `${machineW * 100}%`,
            }}
          >
            <div
              className="relative w-full border-2 border-dashed border-white/10 group-hover:border-white/30 rounded-lg flex items-center justify-center transition-colors"
              style={{ aspectRatio: '1' }}
            >
              <Sparkles className="w-5 h-5 text-white/15 group-hover:text-white/40 transition" />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
