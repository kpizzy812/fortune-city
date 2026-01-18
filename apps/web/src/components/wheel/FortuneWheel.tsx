'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { motion, useAnimation, useMotionValue, useTransform } from 'framer-motion';
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
  const controls = useAnimation();
  const rotation = useMotionValue(0);
  const wheelRef = useRef<SVGGElement>(null);
  const [currentRotation, setCurrentRotation] = useState(0);

  // Calculate sector angle
  const sectorAngle = 360 / sectors.length;

  // Get color for sector
  const getSectorColor = (sector: string) => {
    return SECTOR_COLORS[sector] || DEFAULT_COLOR;
  };

  // Calculate the target rotation for a specific sector
  const calculateTargetRotation = useCallback(
    (targetSector: string) => {
      const sectorIndex = sectors.findIndex((s) => s.sector === targetSector);
      if (sectorIndex === -1) return currentRotation + 360 * 5;

      // Calculate base angle to land on this sector
      // Sectors are drawn clockwise starting from top
      // We need to rotate so the target sector is at the pointer (top)
      const targetAngle = sectorIndex * sectorAngle + sectorAngle / 2;

      // Add multiple full rotations for visual effect
      const fullRotations = 5 + Math.random() * 3; // 5-8 full rotations
      const totalRotation = fullRotations * 360 + (360 - targetAngle);

      return currentRotation + totalRotation;
    },
    [sectors, sectorAngle, currentRotation]
  );

  // Handle spin animation
  useEffect(() => {
    if (isSpinning && resultSector) {
      const targetRotation = calculateTargetRotation(resultSector);

      controls
        .start({
          rotate: targetRotation,
          transition: {
            duration: 4 + Math.random() * 2, // 4-6 seconds
            ease: [0.2, 0.8, 0.3, 1], // Custom easing for realistic spin
          },
        })
        .then(() => {
          setCurrentRotation(targetRotation % 360);
          onSpinComplete?.();
        });
    }
  }, [isSpinning, resultSector, controls, calculateTargetRotation, onSpinComplete]);

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
        animate={controls}
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
        <g ref={wheelRef}>
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
