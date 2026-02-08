'use client';

import { useTranslations } from 'next-intl';
import { Shield, Eye, Lock, FileCode2 } from 'lucide-react';
import { ScrollFadeIn } from './ScrollFadeIn';

const TRUST_ITEMS = [
  { icon: Shield, color: '#00d4ff', titleKey: 'trustSmartContract', descKey: 'trustSmartContractDesc' },
  { icon: Eye, color: '#00ff88', titleKey: 'trustTransparency', descKey: 'trustTransparencyDesc' },
  { icon: Lock, color: '#ffd700', titleKey: 'trustImmutable', descKey: 'trustImmutableDesc' },
  { icon: FileCode2, color: '#ff2d95', titleKey: 'trustOpenSource', descKey: 'trustOpenSourceDesc' },
] as const;

export function TrustSection() {
  const t = useTranslations('landing');

  return (
    <section className="relative py-20 lg:py-28 px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00ff88]/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#00d4ff]/5 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Section title */}
        <ScrollFadeIn className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('trustTitle')}
          </h2>
          <p className="text-[#b0b0b0] text-lg max-w-2xl mx-auto">
            {t('trustSubtitle')}
          </p>
          <div className="w-20 h-1 bg-gradient-to-r from-[#00ff88] to-[#00d4ff] rounded-full mx-auto mt-6" />
        </ScrollFadeIn>

        {/* Trust cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 lg:gap-8">
          {TRUST_ITEMS.map((item, i) => (
            <ScrollFadeIn key={item.titleKey} delay={i * 0.12}>
              <div className="relative bg-[#1a0a2e]/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 h-full">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${item.color}20, ${item.color}05)`,
                    border: `1px solid ${item.color}30`,
                  }}
                >
                  <item.icon className="w-6 h-6" style={{ color: item.color }} />
                </div>
                <h3 className="text-lg font-bold text-white mb-2">
                  {t(item.titleKey)}
                </h3>
                <p className="text-sm text-[#b0b0b0] leading-relaxed">
                  {t(item.descKey)}
                </p>
              </div>
            </ScrollFadeIn>
          ))}
        </div>

        {/* Contract badge — coming after mainnet deploy */}
        <ScrollFadeIn delay={0.5} className="text-center mt-10">
          <div className="inline-flex items-center gap-2 px-6 py-3 border border-[#00ff88]/20 text-[#00ff88]/60 rounded-xl text-sm font-medium">
            <Shield className="w-4 h-4" />
            {t('trustContractSoon')}
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  );
}
