'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import type { RiskyCollectResult } from '@/types';

interface GambleResultAnimationProps {
  isOpen: boolean;
  onClose: () => void;
  result: RiskyCollectResult | null;
}

export function GambleResultAnimation({
  isOpen,
  onClose,
  result,
}: GambleResultAnimationProps) {
  if (!result) return null;

  const won = result.won;
  const emoji = won ? '🎰' : '💔';
  const title = won ? 'YOU WON!' : 'YOU LOST!';
  const color = won ? '#00ff88' : '#ff4444';
  const bgColor = won ? '#00ff88/20' : '#ff4444/20';

  return (
    <Modal isOpen={isOpen} onClose={onClose} showCloseButton={false}>
      <div className="py-6 space-y-6">
        {/* Animated emoji */}
        <AnimatePresence mode="wait">
          <motion.div
            key={won ? 'win' : 'lose'}
            initial={{ scale: 0, rotate: -180 }}
            animate={{
              scale: [0, 1.2, 1],
              rotate: [0, 10, -10, 0],
            }}
            transition={{
              duration: 0.6,
              times: [0, 0.5, 1],
              ease: 'easeOut',
            }}
            className="text-center"
          >
            <div className="text-8xl mb-2">{emoji}</div>
          </motion.div>
        </AnimatePresence>

        {/* Result title */}
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="text-3xl font-bold text-center"
          style={{ color }}
        >
          {title}
        </motion.h2>

        {/* Amount display */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5 }}
          className="bg-[#1a0a2e] rounded-lg p-6 border border-[#ff2d95]/30"
          style={{
            borderColor: color,
            backgroundColor: bgColor,
          }}
        >
          <div className="text-center space-y-2">
            <p className="text-sm text-[#b0b0b0]">
              {won ? 'Original' : 'Lost from'} ${result.originalAmount.toFixed(2)}
            </p>
            <motion.p
              initial={{ scale: 0.5 }}
              animate={{ scale: [1, 1.1, 1] }}
              transition={{ delay: 0.7, duration: 0.4 }}
              className="text-4xl font-bold"
              style={{ color }}
            >
              ${result.finalAmount.toFixed(2)}
            </motion.p>
            <p className="text-xs text-[#b0b0b0]">
              {result.multiplier}x multiplier
            </p>
          </div>
        </motion.div>

        {/* New balance */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9 }}
          className="text-center text-sm text-[#b0b0b0]"
        >
          New Balance: <span className="text-white font-semibold">${result.newBalance.toFixed(2)}</span>
        </motion.div>

        {/* Close button */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
        >
          <Button
            variant="primary"
            size="lg"
            fullWidth
            onClick={onClose}
          >
            Continue
          </Button>
        </motion.div>
      </div>
    </Modal>
  );
}
