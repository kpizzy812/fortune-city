'use client';

import { useTranslations } from 'next-intl';
import { Users, Cpu, Shield } from 'lucide-react';

export function SocialProof() {
  const t = useTranslations('landing');

  const stats = [
    { icon: Cpu, value: '$10', labelKey: 'proofMinDeposit', color: '#ffd700' },
    { icon: Users, value: '10', labelKey: 'proofTiers', color: '#00d4ff' },
    { icon: Shield, value: '100%', labelKey: 'proofOnChain', color: '#00ff88' },
  ] as const;

  return (
    <section className="relative py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <div className="grid grid-cols-3 gap-4">
          {stats.map((stat) => (
            <div key={stat.labelKey} className="text-center">
              <div className="flex justify-center mb-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: `linear-gradient(135deg, ${stat.color}15, ${stat.color}05)`,
                    border: `1px solid ${stat.color}25`,
                  }}
                >
                  <stat.icon className="w-5 h-5" style={{ color: stat.color }} />
                </div>
              </div>
              <div className="text-2xl sm:text-3xl font-bold text-white mb-1">
                {stat.value}
              </div>
              <div className="text-xs sm:text-sm text-[#b0b0b0]">
                {t(stat.labelKey)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
