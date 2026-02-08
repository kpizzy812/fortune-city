'use client';

import { useTranslations } from 'next-intl';
import { UserPlus, ShoppingCart, Coins, Wallet } from 'lucide-react';
import { ScrollFadeIn } from './ScrollFadeIn';

const STEPS = [
  { icon: UserPlus, color: '#00d4ff', titleKey: 'step1Title', descKey: 'step1Desc' },
  { icon: ShoppingCart, color: '#ff2d95', titleKey: 'step2Title', descKey: 'step2Desc' },
  { icon: Coins, color: '#ffd700', titleKey: 'step3Title', descKey: 'step3Desc' },
  { icon: Wallet, color: '#00ff88', titleKey: 'step4Title', descKey: 'step4Desc' },
] as const;

export function HowItWorks() {
  const t = useTranslations('landing');

  return (
    <section id="how-it-works" className="relative py-20 lg:py-32 px-4">
      {/* Background accent */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ff2d95]/30 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#00d4ff]/30 to-transparent" />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto">
        {/* Section title */}
        <ScrollFadeIn className="text-center mb-16">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('howItWorks')}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] rounded-full mx-auto" />
        </ScrollFadeIn>

        {/* Steps grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
          {STEPS.map((step, i) => (
            <ScrollFadeIn key={step.titleKey} delay={i * 0.15}>
              <div className="relative group">
                {/* Step number */}
                <div
                  className="absolute -top-3 -left-1 text-6xl font-bold opacity-10"
                  style={{ color: step.color }}
                >
                  {i + 1}
                </div>

                {/* Card */}
                <div className="relative bg-[#1a0a2e]/60 backdrop-blur-sm border border-white/10 rounded-2xl p-6 hover:border-white/20 transition-all duration-300 h-full">
                  {/* Icon */}
                  <div
                    className="w-14 h-14 rounded-xl flex items-center justify-center mb-4 transition-shadow duration-300 group-hover:shadow-[0_0_20px_var(--glow)]"
                    style={{
                      background: `linear-gradient(135deg, ${step.color}20, ${step.color}05)`,
                      border: `1px solid ${step.color}30`,
                      '--glow': `${step.color}40`,
                    } as React.CSSProperties}
                  >
                    <step.icon className="w-7 h-7" style={{ color: step.color }} />
                  </div>

                  {/* Text */}
                  <h3 className="text-lg font-bold text-white mb-2">
                    {t(step.titleKey)}
                  </h3>
                  <p className="text-sm text-[#b0b0b0] leading-relaxed">
                    {t(step.descKey)}
                  </p>
                </div>
              </div>
            </ScrollFadeIn>
          ))}
        </div>
      </div>
    </section>
  );
}
