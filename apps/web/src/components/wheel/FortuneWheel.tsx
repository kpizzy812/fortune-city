'use client';

import { useRef, useEffect, useCallback } from 'react';
import { motion, useMotionValue, useMotionValueEvent, animate } from 'framer-motion';
import { playTick } from '@/hooks/useFeedback';
import { useUIStore } from '@/stores/ui.store';
import type { WheelSector } from '@/lib/api';

interface FortuneWheelProps {
  sectors: WheelSector[];
  isSpinning: boolean;
  resultSector?: string;
  onSpinComplete?: () => void;
}

// Sector colors for visual appeal
const SECTOR_COLORS: Record<string, { bg: string; text: string }> = {
  '5x': { bg: '#ff2d95', text: '#fff' },      // Pink (jackpot-like)
  '2x': { bg: '#9333ea', text: '#fff' },      // Purple
  '1.5x': { bg: '#3b82f6', text: '#fff' },    // Blue
  '1x': { bg: '#22c55e', text: '#fff' },      // Green (free spin)
  '0.5x': { bg: '#f59e0b', text: '#000' },    // Amber
  '0.2x': { bg: '#6b7280', text: '#fff' },    // Gray
  'empty': { bg: '#1f2937', text: '#9ca3af' }, // Dark gray
  'jackpot': { bg: '#ffd700', text: '#000' },  // Gold
};

const DEFAULT_COLOR = { bg: '#374151', text: '#fff' };

export function FortuneWheel({
  sectors,
  isSpinning,
  resultSector,
  onSpinComplete,
}: FortuneWheelProps) {
  const rotation = useMotionValue(0);
  const currentRotationRef = useRef(0);
  const lastTickSector = useRef(-1);
  const spinningRef = useRef(false);

  const sectorAngle = sectors.length > 0 ? 360 / sectors.length : 30;

  const getSectorColor = (sector: string) => {
    return SECTOR_COLORS[sector] || DEFAULT_COLOR;
  };

  // Track spinning state in ref for motion value event callback
  useEffect(() => {
    spinningRef.current = isSpinning;
    if (!isSpinning) {
      lastTickSector.current = -1;
    }
  }, [isSpinning]);

  // Tick on every sector crossing during spin
  useMotionValueEvent(rotation, 'change', (latest) => {
    if (!spinningRef.current || sectors.length === 0) return;

    // Calculate which sector the pointer is at (pointer is at top = 0°)
    const normalizedAngle = ((latest % 360) + 360) % 360;
    const currentSector = Math.floor(normalizedAngle / sectorAngle) % sectors.length;

    if (currentSector !== lastTickSector.current) {
      lastTickSector.current = currentSector;
      const muted = useUIStore.getState().soundMuted;
      playTick(muted);
    }
  });

  // Calculate the target rotation for a specific sector
  const calculateTargetRotation = useCallback(
    (targetSector: string) => {
      const cur = currentRotationRef.current;
      const sectorIndex = sectors.findIndex((s) => s.sector === targetSector);
      if (sectorIndex === -1) return cur + 360 * 5;

      // Center of the target sector (clockwise from top, in degrees)
      const targetAngle = sectorIndex * sectorAngle + sectorAngle / 2;

      // To place this sector under the pointer (top), the wheel's
      // rotation modulo 360 must equal (360 - targetAngle)
      const desiredMod = ((360 - targetAngle) % 360 + 360) % 360;
      const currentMod = ((cur % 360) + 360) % 360;

      // Additional rotation to reach the desired sector from current position
      let delta = desiredMod - currentMod;
      if (delta < 0) delta += 360;

      // Add 5-8 full rotations for visual effect
      const fullRotations = 5 + Math.floor(Math.random() * 3);
      return cur + fullRotations * 360 + delta;
    },
    [sectors, sectorAngle]
  );

  // Handle spin animation
  useEffect(() => {
    if (isSpinning && resultSector) {
      const targetRotation = calculateTargetRotation(resultSector);

      const controls = animate(rotation, targetRotation, {
        duration: 4 + Math.random() * 2, // 4-6 seconds
        ease: [0.2, 0.8, 0.3, 1], // Custom easing for realistic spin
        onComplete: () => {
          currentRotationRef.current = targetRotation;
          onSpinComplete?.();
        },
      });

      return () => controls.stop();
    }
  }, [isSpinning, resultSector, calculateTargetRotation, onSpinComplete, rotation]);

  // Generate SVG path for a sector
  const getSectorPath = (index: number) => {
    const startAngle = (index * sectorAngle - 90) * (Math.PI / 180);
    const endAngle = ((index + 1) * sectorAngle - 90) * (Math.PI / 180);
    const radius = 140;
    const centerX = 150;
    const centerY = 150;

    const x1 = centerX + radius * Math.cos(startAngle);
    const y1 = centerY + radius * Math.sin(startAngle);
    const x2 = centerX + radius * Math.cos(endAngle);
    const y2 = centerY + radius * Math.sin(endAngle);

    const largeArcFlag = sectorAngle > 180 ? 1 : 0;

    return `M ${centerX} ${centerY} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2} Z`;
  };

  // Get label position for a sector
  const getLabelPosition = (index: number) => {
    const angle = ((index * sectorAngle + sectorAngle / 2 - 90) * Math.PI) / 180;
    const radius = 100;
    const centerX = 150;
    const centerY = 150;

    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      rotation: index * sectorAngle + sectorAngle / 2,
    };
  };

  // Format sector label
  const formatSectorLabel = (sector: WheelSector) => {
    if (sector.sector === 'jackpot') return 'JACKPOT';
    if (sector.sector === 'empty') return 'X';
    return sector.sector.toUpperCase();
  };

  return (
    <div className="relative w-[300px] h-[300px] mx-auto">
      {/* Pointer */}
      <div
        className="
          absolute top-0 left-1/2 -translate-x-1/2 -translate-y-2 z-20
          w-0 h-0
          border-l-[12px] border-l-transparent
          border-r-[12px] border-r-transparent
          border-t-[24px] border-t-[#ff2d95]
          drop-shadow-[0_0_10px_rgba(255,45,149,0.8)]
        "
      />

      {/* Wheel container */}
      <motion.svg
        viewBox="0 0 300 300"
        className="w-full h-full drop-shadow-2xl"
        style={{ rotate: rotation }}
      >
        {/* Outer glow ring */}
        <circle
          cx="150"
          cy="150"
          r="148"
          fill="none"
          stroke="url(#outerGlow)"
          strokeWidth="4"
        />

        {/* Main wheel group */}
        <g>
          {/* Sectors */}
          {sectors.map((sector, index) => {
            const color = getSectorColor(sector.sector);
            const labelPos = getLabelPosition(index);

            return (
              <g key={`sector-${index}`}>
                {/* Sector path */}
                <path
                  d={getSectorPath(index)}
                  fill={color.bg}
                  stroke="#1a0a2e"
                  strokeWidth="2"
                />

                {/* Sector label */}
                <text
                  x={labelPos.x}
                  y={labelPos.y}
                  fill={color.text}
                  fontSize="12"
                  fontWeight="bold"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  transform={`rotate(${labelPos.rotation}, ${labelPos.x}, ${labelPos.y})`}
                  className="select-none"
                >
                  {formatSectorLabel(sector)}
                </text>
              </g>
            );
          })}

          {/* Center hub */}
          <circle cx="150" cy="150" r="30" fill="#1a0a2e" stroke="#ff2d95" strokeWidth="3" />
          <circle cx="150" cy="150" r="20" fill="#ff2d95" />
          <text
            x="150"
            y="150"
            fill="#fff"
            fontSize="10"
            fontWeight="bold"
            textAnchor="middle"
            dominantBaseline="middle"
          >
            SPIN
          </text>
        </g>

        {/* Gradient definitions */}
        <defs>
          <linearGradient id="outerGlow" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#ff2d95" />
            <stop offset="50%" stopColor="#9333ea" />
            <stop offset="100%" stopColor="#ff2d95" />
          </linearGradient>
        </defs>
      </motion.svg>

      {/* Spinning indicator */}
      {isSpinning && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-16 h-16 rounded-full border-4 border-transparent border-t-[#ff2d95] animate-spin" />
        </div>
      )}
    </div>
  );
}
