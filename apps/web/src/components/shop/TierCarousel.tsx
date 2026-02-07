'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ChevronLeft, ChevronRight, Tag, TrendingDown, TrendingUp } from 'lucide-react';
import type { TierInfo, CanAffordResponse, Machine } from '@/types';
import { Button } from '@/components/ui/Button';
import { Tooltip } from '@/components/ui/Tooltip';

interface TierCarouselProps {
  tiers: TierInfo[];
  affordability: Record<number, CanAffordResponse>;
  machinesByTier: Record<number, Machine>;
  maxTierReached: number;
  onBuyTier: (tier: number) => void;
  onSellMachine: (machine: Machine) => void;
  onTopUpAndBuy: (tier: TierInfo, shortfall: number) => void;
  isPurchasing: boolean;
  isLoading: boolean;
}

// Format large numbers compactly
function formatCompactNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(num % 1000000 === 0 ? 0 : 1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(num % 1000 === 0 ? 0 : 1)}K`;
  }
  return num.toLocaleString();
}

interface TierCardTranslations {
  tierBadge: (params: { tier: number }) => string;
  locked: string;
  duration: string;
  yield: string;
  profit: string;
  reachTierFirst: (params: { tier: number }) => string;
  needMore: (params: { amount: string }) => string;
  purchasing: string;
  buyMachine: string;
  sellMachine: string;
  reinvestNewTier: string;
  reinvestRepeatBadge: (params: { round: number }) => string;
  reinvestPenaltyTooltip: string;
  reinvestNewTierTooltip: string;
}

function TierCard({
  tier,
  canAfford,
  machine,
  maxTierReached,
  onBuy,
  onSell,
  onTopUpAndBuy,
  isPurchasing,
  t,
}: {
  tier: TierInfo;
  canAfford: CanAffordResponse | null;
  machine: Machine | null;
  maxTierReached: number;
  onBuy: () => void;
  onSell: () => void;
  onTopUpAndBuy: () => void;
  isPurchasing: boolean;
  t: TierCardTranslations;
}) {
  // Use tierLocked from backend if available, fallback to local logic
  const isLocked = canAfford?.tierLocked ?? tier.tier > maxTierReached + 1;
  const hasActiveMachine = canAfford?.hasActiveMachine ?? false;
  const isAffordable = canAfford?.canAfford ?? false;
  const canBuy = !isLocked && !hasActiveMachine && isAffordable && !isPurchasing;
  const baseProfit = tier.price * (tier.yieldPercent / 100 - 1);

  // Reinvest penalty info - показываем только когда нет активной машины
  const reductionRate = canAfford?.nextProfitReduction ?? 0;
  const hasReinvestPenalty = reductionRate > 0;
  const isUpgrade = canAfford?.isUpgrade ?? false;
  // Показываем penalty только когда машина не активна (можно купить)
  const showPenalty = hasReinvestPenalty && !hasActiveMachine;
  const actualProfit = showPenalty ? baseProfit * (1 - reductionRate / 100) : baseProfit;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={!isLocked ? { scale: 1.02 } : {}}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      style={{ transformOrigin: 'center center' }}
      className={`
        relative
        bg-gradient-to-br from-[#2a1a4e] to-[#1a0a2e]
        rounded-2xl overflow-hidden
        border-2 transition-all duration-300
        min-w-[280px] w-[280px]
        ${
          isLocked
            ? 'border-[#6b6b6b]/30 opacity-60'
            : canBuy
              ? 'border-[#00d4ff]/50 hover:border-[#00d4ff] hover:shadow-[0_0_30px_rgba(0,212,255,0.3)]'
              : 'border-[#ff2d95]/30 hover:border-[#ff2d95]/50'
        }
      `}
    >
      {/* Square image header with overlay */}
      <div className="relative w-full aspect-square">
        {/* Background gradient */}
        <div className={`
          absolute inset-0
          bg-gradient-to-br
          ${tier.tier <= 3 ? 'from-[#ff2d95]/30 to-[#00d4ff]/30' :
            tier.tier <= 6 ? 'from-[#ffd700]/30 to-[#ff8c00]/30' :
            'from-[#00ff88]/30 to-[#00d4ff]/30'}
        `} />

        {/* Machine image */}
        <div className="absolute inset-0 flex items-center justify-center p-4">
          <div className="relative w-full h-full">
            <Image
              src={tier.imageUrl}
              alt={tier.name}
              fill
              className="object-contain drop-shadow-2xl"
              sizes="280px"
            />
          </div>
        </div>

        {/* Tier badge - top right */}
        <div className="absolute top-3 right-3 z-10">
          <span className={`
            px-2.5 py-1 rounded-full text-[10px] font-bold backdrop-blur-sm
            ${tier.tier <= 3 ? 'bg-[#ff2d95]/50 text-white' :
              tier.tier <= 6 ? 'bg-[#ffd700]/50 text-white' :
              'bg-[#00ff88]/50 text-white'}
          `}>
            {t.tierBadge({ tier: tier.tier })}
          </span>
        </div>

        {/* Bottom gradient overlay for text */}
        <div className="absolute bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-[#1a0a2e] to-transparent" />

        {/* Name and price - bottom */}
        <div className="absolute bottom-3 left-3 right-3 z-10">
          <h3 className="font-bold text-white text-lg leading-tight truncate drop-shadow-lg">
            {tier.name}
          </h3>
          <div className="flex items-center justify-between">
            <p className="text-2xl font-bold text-[#ffd700] drop-shadow-[0_0_10px_rgba(255,215,0,0.5)]">
              ${tier.price.toLocaleString()}
            </p>
            {isLocked ? (
              <span className="flex items-center gap-1 text-[#ff4444] text-xs font-medium">
                <Lock className="w-3 h-3" /> {t.locked}
              </span>
            ) : !hasActiveMachine && isUpgrade ? (
              <Tooltip content={t.reinvestNewTierTooltip} position="top" showIcon={false}>
                <span className="flex items-center gap-1 text-[#00ff88] text-xs font-medium cursor-help">
                  <TrendingUp className="w-3 h-3" /> {t.reinvestNewTier}
                </span>
              </Tooltip>
            ) : !hasActiveMachine && showPenalty ? (
              <Tooltip content={t.reinvestPenaltyTooltip} position="top" showIcon={false}>
                <span className="flex items-center gap-1 text-[#ffaa00] text-xs font-medium cursor-help">
                  <TrendingDown className="w-3 h-3" /> {t.reinvestRepeatBadge({ round: canAfford?.nextReinvestRound ?? 2 })}
                </span>
              </Tooltip>
            ) : null}
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="p-3">
        <div className="grid grid-cols-3 gap-1.5 mb-2">
          <div className="bg-[#1a0a2e]/80 backdrop-blur rounded-lg p-2 text-center border border-white/5">
            <p className="text-[9px] text-[#b0b0b0] uppercase tracking-wider">{t.duration}</p>
            <p className="text-sm font-bold text-white">{tier.lifespanDays}d</p>
          </div>
          <div className="bg-[#1a0a2e]/80 backdrop-blur rounded-lg p-2 text-center border border-white/5">
            <p className="text-[9px] text-[#b0b0b0] uppercase tracking-wider">{t.yield}</p>
            <p className="text-sm font-bold text-[#00ff88]">{tier.yieldPercent}%</p>
          </div>
          <div className="bg-[#1a0a2e]/80 backdrop-blur rounded-lg p-2 text-center border border-white/5">
            <p className="text-[9px] text-[#b0b0b0] uppercase tracking-wider">{t.profit}</p>
            <div className={`text-sm font-bold ${showPenalty ? 'text-[#ffaa00]' : 'text-[#ffd700]'} flex items-center justify-center gap-0.5`}>
              <span>${formatCompactNumber(actualProfit)}</span>
              {showPenalty && (
                <Tooltip
                  content={t.reinvestPenaltyTooltip}
                  position="top"
                  showIcon={false}
                >
                  <span className="text-[8px] text-[#ff6666] cursor-help">-{reductionRate.toFixed(0)}%</span>
                </Tooltip>
              )}
            </div>
          </div>
        </div>

        {/* Button */}
        {isLocked ? (
          <Button variant="ghost" size="sm" fullWidth disabled>
            {t.reachTierFirst({ tier: tier.tier - 1 })}
          </Button>
        ) : hasActiveMachine && machine ? (
          <Button
            variant="secondary"
            size="sm"
            fullWidth
            onClick={onSell}
            className="flex items-center justify-center gap-1.5"
          >
            <Tag className="w-3.5 h-3.5" />
            {t.sellMachine}
          </Button>
        ) : !isAffordable && canAfford ? (
          <Button variant="gold" size="sm" fullWidth onClick={onTopUpAndBuy}>
            {t.buyMachine}
          </Button>
        ) : (
          <Button
            variant="gold"
            size="sm"
            fullWidth
            onClick={onBuy}
            loading={isPurchasing}
            disabled={!canBuy}
          >
            {isPurchasing ? t.purchasing : t.buyMachine}
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export function TierCarousel({
  tiers,
  affordability,
  machinesByTier,
  maxTierReached,
  onBuyTier,
  onSellMachine,
  onTopUpAndBuy,
  isPurchasing,
  isLoading,
}: TierCarouselProps) {
  const tShop = useTranslations('shop');
  const tSell = useTranslations('sell');
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);
  const [activeIndex, setActiveIndex] = useState(0);

  // Card width for calculations (280px card + 20px gap)
  const cardWidthWithGap = 300;

  // Check scroll position
  const checkScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;

    // Left arrow appears when scrolled more than 10px from start
    setCanScrollLeft(container.scrollLeft > 10);
    setCanScrollRight(
      container.scrollLeft < container.scrollWidth - container.clientWidth - 10
    );

    // Calculate active index based on scroll position
    const newIndex = Math.max(0, Math.round(container.scrollLeft / cardWidthWithGap));
    setActiveIndex(newIndex);
  };

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (container) {
      checkScroll();
      container.addEventListener('scroll', checkScroll);
      return () => container.removeEventListener('scroll', checkScroll);
    }
  }, [tiers.length]);

  const scrollTo = (direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const scrollAmount = direction === 'left' ? -cardWidthWithGap * 2 : cardWidthWithGap * 2;
    container.scrollBy({ left: scrollAmount, behavior: 'smooth' });
  };

  const scrollToIndex = (index: number) => {
    const container = scrollContainerRef.current;
    if (!container) return;

    container.scrollTo({
      left: cardWidthWithGap * index,
      behavior: 'smooth'
    });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
      </div>
    );
  }

  if (tiers.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-[#b0b0b0]">{tShop('noTiersAvailable')}</p>
      </div>
    );
  }

  // Translations object to pass to TierCard
  const cardTranslations: TierCardTranslations = {
    tierBadge: (params) => tShop('tierBadge', params),
    locked: tShop('locked'),
    duration: tShop('duration'),
    yield: tShop('yield'),
    profit: tShop('profit'),
    reachTierFirst: (params) => tShop('reachTierFirst', params),
    needMore: (params) => tShop('needMore', params),
    purchasing: tShop('purchasing'),
    buyMachine: tShop('buyMachine'),
    sellMachine: tSell('sellMachine'),
    reinvestNewTier: tShop('reinvest.newTier'),
    reinvestRepeatBadge: (params) => tShop('reinvest.repeatBadge', params),
    reinvestPenaltyTooltip: tShop('reinvest.penaltyTooltip'),
    reinvestNewTierTooltip: tShop('reinvest.newTierTooltip'),
  };

  return (
    <div className="relative">
      {/* Desktop Navigation Arrows */}
      <div className="hidden lg:block">
        <AnimatePresence>
          {canScrollLeft && (
            <motion.button
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              onClick={() => scrollTo('left')}
              className="absolute -left-5 top-1/2 -translate-y-1/2 z-50 w-10 h-10 bg-[#2a1a4e]/90 border border-[#00d4ff]/50 rounded-full flex items-center justify-center text-[#00d4ff] hover:bg-[#00d4ff]/20 transition shadow-lg backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {canScrollRight && (
            <motion.button
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              onClick={() => scrollTo('right')}
              className="absolute -right-5 top-1/2 -translate-y-1/2 z-50 w-10 h-10 bg-[#2a1a4e]/90 border border-[#00d4ff]/50 rounded-full flex items-center justify-center text-[#00d4ff] hover:bg-[#00d4ff]/20 transition shadow-lg backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Scrollable Container with edge gradients */}
      <div className="relative">
        {/* Left edge gradient */}
        <div
          className={`
            absolute left-0 top-0 bottom-0 w-12 z-10
            bg-gradient-to-r from-[#1a0a2e] to-transparent
            pointer-events-none transition-opacity duration-300
            ${canScrollLeft ? 'opacity-100' : 'opacity-0'}
          `}
        />

        {/* Right edge gradient */}
        <div
          className={`
            absolute right-0 top-0 bottom-0 w-12 z-10
            bg-gradient-to-l from-[#1a0a2e] to-transparent
            pointer-events-none transition-opacity duration-300
            ${canScrollRight ? 'opacity-100' : 'opacity-0'}
          `}
        />

        <div
          ref={scrollContainerRef}
          className="flex gap-5 overflow-x-auto snap-x snap-mandatory py-2 px-6 lg:py-6 lg:px-10 max-lg:[scroll-padding-inline:calc(50%-140px)]"
          style={{
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {/* Spacer for mobile centering */}
          <div className="flex-shrink-0 w-[calc(50vw-140px-1rem)] lg:hidden" aria-hidden="true" />
          {tiers.map((tier) => {
            const machine = machinesByTier[tier.tier] || null;
            return (
              <div
                key={tier.tier}
                className="snap-center lg:snap-start flex-shrink-0 relative z-30 hover:z-40 p-2 -m-2"
              >
                <TierCard
                  tier={tier}
                  canAfford={affordability[tier.tier]}
                  machine={machine}
                  maxTierReached={maxTierReached}
                  onBuy={() => onBuyTier(tier.tier)}
                  onSell={() => machine && onSellMachine(machine)}
                  onTopUpAndBuy={() => {
                    const canAffordInfo = affordability[tier.tier];
                    if (canAffordInfo) {
                      onTopUpAndBuy(tier, canAffordInfo.shortfall);
                    }
                  }}
                  isPurchasing={isPurchasing}
                  t={cardTranslations}
                />
              </div>
            );
          })}
          {/* Spacer for mobile centering */}
          <div className="flex-shrink-0 w-[calc(50vw-140px-1rem)] lg:hidden" aria-hidden="true" />
        </div>
      </div>

      {/* Pagination dots */}
      <div className="flex justify-center gap-2 mt-4">
        {tiers.map((_, index) => (
          <button
            key={index}
            onClick={() => scrollToIndex(index)}
            className={`
              w-2 h-2 rounded-full transition-all duration-300
              ${activeIndex === index
                ? 'w-6 bg-[#00d4ff]'
                : 'bg-[#6b6b6b]/50 hover:bg-[#6b6b6b]'}
            `}
          />
        ))}
      </div>

      {/* Quick tier selector for desktop */}
      <div className="hidden lg:flex justify-center gap-2 mt-4 flex-wrap">
        {tiers.map((tier) => {
          const isLocked = tier.tier > maxTierReached + 1;
          const isActive = activeIndex === tier.tier - 1;
          return (
            <button
              key={tier.tier}
              onClick={() => scrollToIndex(tier.tier - 1)}
              className={`
                px-3 py-1.5 rounded-lg text-sm font-medium transition-all
                ${isActive
                  ? 'bg-[#00d4ff] text-[#1a0a2e]'
                  : isLocked
                    ? 'bg-[#2a1a4e]/50 text-[#6b6b6b]'
                    : 'bg-[#2a1a4e] text-[#b0b0b0] hover:text-white hover:bg-[#2a1a4e]/80'}
              `}
            >
              <Image src={tier.imageUrl} alt={tier.name} width={20} height={20} className="inline-block object-contain" /> T{tier.tier}
            </button>
          );
        })}
      </div>
    </div>
  );
}
