'use client';

import { motion } from 'framer-motion';

type ProgressVariant = 'default' | 'gold' | 'danger' | 'success';

interface ProgressBarProps {
  value: number;
  max: number;
  variant?: ProgressVariant;
  showLabel?: boolean;
  labelFormat?: 'percent' | 'value' | 'fraction';
  size?: 'sm' | 'md' | 'lg';
  animated?: boolean;
  className?: string;
}

const variantColors: Record<ProgressVariant, { bg: string; fill: string }> = {
  default: {
    bg: 'bg-[#1a0a2e]',
    fill: 'bg-gradient-to-r from-[#ff2d95] to-[#00d4ff]',
  },
  gold: {
    bg: 'bg-[#1a0a2e]',
    fill: 'bg-gradient-to-r from-[#ffd700] to-[#ff8c00]',
  },
  danger: {
    bg: 'bg-[#1a0a2e]',
    fill: 'bg-[#ff4444]',
  },
  success: {
    bg: 'bg-[#1a0a2e]',
    fill: 'bg-[#00ff88]',
  },
};

const sizeStyles: Record<string, string> = {
  sm: 'h-1.5',
  md: 'h-2.5',
  lg: 'h-4',
};

export function ProgressBar({
  value,
  max,
  variant = 'default',
  showLabel = false,
  labelFormat = 'percent',
  size = 'md',
  animated = true,
  className = '',
}: ProgressBarProps) {
  const percent = Math.min(100, Math.max(0, (value / max) * 100));
  const colors = variantColors[variant];

  const formatLabel = () => {
    switch (labelFormat) {
      case 'percent':
        return `${Math.round(percent)}%`;
      case 'value':
        return `${value.toFixed(2)}`;
      case 'fraction':
        return `${value.toFixed(0)}/${max.toFixed(0)}`;
      default:
        return `${Math.round(percent)}%`;
    }
  };

  return (
    <div className={`w-full ${className}`}>
      {showLabel && (
        <div className="flex justify-between mb-1">
          <span className="text-xs text-[#b0b0b0]">{formatLabel()}</span>
        </div>
      )}
      <div
        className={`
          w-full rounded-full overflow-hidden
          ${colors.bg}
          ${sizeStyles[size]}
        `}
      >
        <motion.div
          className={`h-full rounded-full ${colors.fill}`}
          initial={animated ? { width: 0 } : { width: `${percent}%` }}
          animate={{ width: `${percent}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>
    </div>
  );
}
