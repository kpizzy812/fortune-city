'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Info } from 'lucide-react';

interface TooltipProps {
  content: string;
  children?: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  showIcon?: boolean;
}

export function Tooltip({
  content,
  children,
  position = 'top',
  showIcon = true,
}: TooltipProps) {
  const [isVisible, setIsVisible] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ top: 0, left: 0 });
  const triggerRef = useRef<HTMLDivElement>(null);
  const isMounted = typeof window !== 'undefined';

  // Calculate tooltip position
  const updatePosition = useCallback(() => {
    if (!triggerRef.current) return;

    const rect = triggerRef.current.getBoundingClientRect();
    const scrollY = window.scrollY;
    const scrollX = window.scrollX;

    let top = 0;
    let left = 0;

    switch (position) {
      case 'top':
        top = rect.top + scrollY - 8;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'bottom':
        top = rect.bottom + scrollY + 8;
        left = rect.left + scrollX + rect.width / 2;
        break;
      case 'left':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.left + scrollX - 8;
        break;
      case 'right':
        top = rect.top + scrollY + rect.height / 2;
        left = rect.right + scrollX + 8;
        break;
    }

    setTooltipPosition({ top, left });
  }, [position]);

  // Close tooltip when clicking outside
  useEffect(() => {
    if (!isVisible) return;

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(e.target as Node)
      ) {
        setIsVisible(false);
      }
    };

    const handleScroll = () => {
      updatePosition();
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    window.addEventListener('scroll', handleScroll, true);
    window.addEventListener('resize', updatePosition);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
      window.removeEventListener('scroll', handleScroll, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [isVisible, updatePosition]);

  const handleToggle = useCallback(() => {
    if (!isVisible) {
      updatePosition();
    }
    setIsVisible((prev) => !prev);
  }, [isVisible, updatePosition]);

  const handleMouseEnter = useCallback(() => {
    updatePosition();
    setIsVisible(true);
  }, [updatePosition]);

  const handleMouseLeave = useCallback(() => {
    setIsVisible(false);
  }, []);

  const getTooltipStyles = (): React.CSSProperties => {
    const base: React.CSSProperties = {
      position: 'absolute',
      zIndex: 9999,
    };

    switch (position) {
      case 'top':
        return {
          ...base,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translate(-50%, -100%)',
        };
      case 'bottom':
        return {
          ...base,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translate(-50%, 0)',
        };
      case 'left':
        return {
          ...base,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translate(-100%, -50%)',
        };
      case 'right':
        return {
          ...base,
          top: tooltipPosition.top,
          left: tooltipPosition.left,
          transform: 'translate(0, -50%)',
        };
    }
  };

  const arrowClasses = {
    top: 'top-full left-1/2 -translate-x-1/2 border-t-[#2a1a4e] border-x-transparent border-b-transparent',
    bottom: 'bottom-full left-1/2 -translate-x-1/2 border-b-[#2a1a4e] border-x-transparent border-t-transparent',
    left: 'left-full top-1/2 -translate-y-1/2 border-l-[#2a1a4e] border-y-transparent border-r-transparent',
    right: 'right-full top-1/2 -translate-y-1/2 border-r-[#2a1a4e] border-y-transparent border-l-transparent',
  };

  const tooltipContent = isVisible && isMounted && (
    <div
      style={getTooltipStyles()}
      className="px-3 py-2 text-xs text-white bg-[#2a1a4e] border border-[#ff2d95]/30 rounded-lg shadow-xl min-w-[200px] max-w-[280px] whitespace-normal pointer-events-none"
    >
      {content}
      {/* Arrow */}
      <div
        className={`absolute w-0 h-0 border-[6px] ${arrowClasses[position]}`}
      />
    </div>
  );

  return (
    <>
      {/* Trigger */}
      <div
        ref={triggerRef}
        className="inline-flex items-center gap-1 cursor-pointer"
        onClick={handleToggle}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        {children}
        {showIcon && (
          <Info className="w-3.5 h-3.5 text-[#b0b0b0] hover:text-[#00d4ff] transition-colors" />
        )}
      </div>

      {/* Portal tooltip */}
      {isMounted && createPortal(tooltipContent, document.body)}
    </>
  );
}
