'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Gamepad2 } from 'lucide-react';
import type { Machine, MachineIncome } from '@/types';
import { MachineCard } from './MachineCard';
import { Button } from '@/components/ui/Button';

interface MachineGridProps {
  machines: Machine[];
  incomes: Record<string, MachineIncome>;
  onCollect: (machineId: string) => void;
  isCollecting: Record<string, boolean>;
  isLoading?: boolean;
}

export function MachineGrid({
  machines,
  incomes,
  onCollect,
  isCollecting,
  isLoading = false,
}: MachineGridProps) {
  // Loading state
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent mb-4" />
        <p className="text-[#b0b0b0]">Loading your machines...</p>
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
          flex flex-col items-center justify-center py-12
          bg-[#2a1a4e] rounded-xl border border-[#00d4ff]/30
        "
      >
        <Gamepad2 className="w-16 h-16 mb-4 text-[#00d4ff]" />
        <h3 className="text-xl font-semibold text-white mb-2">No machines yet</h3>
        <p className="text-[#b0b0b0] text-center mb-6 max-w-xs">
          Buy your first slot machine to start earning $FORTUNE!
        </p>
        <Link href="/shop">
          <Button variant="primary" size="lg">
            Visit Shop
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
            isCollecting={isCollecting[machine.id] || false}
          />
        </motion.div>
      ))}
    </div>
  );
}
