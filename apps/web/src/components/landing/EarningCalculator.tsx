'use client';

import { useState, useMemo, useEffect } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { TAX_RATES_BY_TIER } from '@fortune-city/shared';
import { TrendingUp } from 'lucide-react';
import { api } from '@/lib/api';
import type { TierInfo } from '@/types';
import { ScrollFadeIn } from './ScrollFadeIn';

export function EarningCalculator() {
  const t = useTranslations('landing');
  const [tiers, setTiers] = useState<TierInfo[]>([]);
  const [selectedTier, setSelectedTier] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch visible tiers from API
  useEffect(() => {
    api.getTiers()
      .then((data) => {
        setTiers(data);
        if (data.length > 0) {
          setSelectedTier(data[0].tier);
        }
      })
      .catch(() => {
        // Fallback: show nothing if API unavailable
      })
      .finally(() => setIsLoading(false));
  }, []);

  const stats = useMemo(() => {
    if (!selectedTier) return null;
    const tier = tiers.find((t) => t.tier === selectedTier);
    if (!tier) return null;

    const totalReturn = tier.price * (tier.yieldPercent / 100);
    const grossProfit = totalReturn - tier.price;
    const dailyIncome = totalReturn / tier.lifespanDays;
    const taxRate = TAX_RATES_BY_TIER[tier.tier] ?? 0.5;
    const netProfit = grossProfit * (1 - taxRate);
    const dailyReturn = ((tier.yieldPercent / 100 - 1) / tier.lifespanDays) * 100;

    return {
      price: tier.price,
      name: tier.name,
      imageUrl: tier.imageUrl,
      lifespanDays: tier.lifespanDays,
      yieldPercent: tier.yieldPercent,
      totalReturn,
      grossProfit,
      dailyIncome,
      taxRate,
      netProfit,
      dailyReturn,
    };
  }, [selectedTier, tiers]);

  // Don't render if no tiers available
  if (!isLoading && tiers.length === 0) return null;

  // Adaptive grid columns based on tier count
  const gridCols = tiers.length <= 3
    ? 'grid-cols-3'
    : tiers.length <= 5
      ? 'grid-cols-5'
      : 'grid-cols-5';

  return (
    <section className="relative py-20 lg:py-32 px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ffd700]/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ffd700]/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Section title */}
        <ScrollFadeIn className="text-center mb-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('calcTitle')}
          </h2>
          <p className="text-[#b0b0b0] text-lg">
            {t('calcSubtitle')}
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-[#ffd700] to-[#ff2d95] rounded-full mx-auto mt-6" />
        </ScrollFadeIn>

        {/* Progression explanation */}
        <ScrollFadeIn delay={0.1}>
          <div className="flex items-start gap-3 bg-[#1a0a2e]/40 border border-white/5 rounded-xl p-4 mb-6">
            <TrendingUp className="w-5 h-5 text-[#ffd700] shrink-0 mt-0.5" />
            <p className="text-sm text-[#b0b0b0] leading-relaxed">
              {t('calcProgression')}
            </p>
          </div>
        </ScrollFadeIn>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#ffd700] border-t-transparent" />
          </div>
        ) : stats && (
          <ScrollFadeIn delay={0.2}>
            <div className="bg-[#1a0a2e]/60 backdrop-blur-sm border border-white/10 rounded-2xl p-5 lg:p-8">
              {/* Tier selector */}
              <div className="mb-6">
                <label className="text-sm text-[#b0b0b0] mb-3 block">
                  {t('calcSelectTier')}
                </label>
                <div className={`grid ${gridCols} gap-2`}>
                  {tiers.map((tier) => (
                    <button
                      key={tier.tier}
                      onClick={() => setSelectedTier(tier.tier)}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all duration-200 ${
                        selectedTier === tier.tier
                          ? 'border-[#ffd700]/60 bg-[#ffd700]/10 shadow-[0_0_15px_rgba(255,215,0,0.15)]'
                          : 'border-white/10 hover:border-white/20 hover:bg-white/5'
                      }`}
                    >
                      <Image
                        src={tier.imageUrl || `/machines/tier-${tier.tier}.png`}
                        alt={tier.name}
                        width={36}
                        height={36}
                        className="w-8 h-8 sm:w-9 sm:h-9"
                      />
                      <span className={`text-xs font-bold ${
                        selectedTier === tier.tier ? 'text-[#ffd700]' : 'text-white/60'
                      }`}>
                        {tier.tier}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Machine info header */}
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
                <Image
                  src={stats.imageUrl || `/machines/tier-${selectedTier}.png`}
                  alt={stats.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 drop-shadow-[0_0_10px_rgba(255,215,0,0.3)]"
                />
                <div>
                  <div className="text-white font-bold text-lg">{stats.name}</div>
                  <div className="text-[#b0b0b0] text-sm">
                    {t('calcTierLabel', { tier: selectedTier! })} &bull; ${stats.price.toLocaleString()}
                  </div>
                </div>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <StatCard
                  label={t('calcInvestment')}
                  value={`$${stats.price.toLocaleString()}`}
                  color="#b0b0b0"
                />
                <StatCard
                  label={t('calcCycle')}
                  value={`${stats.lifespanDays} ${t('calcDays')}`}
                  color="#b0b0b0"
                />
                <StatCard
                  label={t('calcTotalReturn')}
                  value={`$${stats.totalReturn.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  color="#00d4ff"
                />
                <StatCard
                  label={t('calcGrossProfit')}
                  value={`+$${stats.grossProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                  color="#00ff88"
                />
                <StatCard
                  label={t('calcDailyIncome')}
                  value={`$${stats.dailyIncome.toLocaleString(undefined, { maximumFractionDigits: 2 })}/day`}
                  color="#ffd700"
                />
                <StatCard
                  label={t('calcDailyReturn')}
                  value={`${stats.dailyReturn.toFixed(1)}%`}
                  color="#ffd700"
                />
              </div>

              {/* City fee note */}
              <div className="bg-[#2a1a4e]/40 rounded-xl p-4 border border-white/5">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-[#b0b0b0]">{t('calcCityFee')}</span>
                  <span className="text-sm font-bold text-[#ff2d95]">
                    {(stats.taxRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-[#b0b0b0]">{t('calcNetProfit')}</span>
                  <span className="text-sm font-bold text-[#00ff88]">
                    +${stats.netProfit.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
                <p className="text-xs text-white/30 mt-2">
                  {t('calcFeeNote')}
                </p>
              </div>
            </div>
          </ScrollFadeIn>
        )}
      </div>
    </section>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="bg-[#2a1a4e]/40 rounded-xl p-3 border border-white/5">
      <div className="text-xs text-[#b0b0b0] mb-1">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}
