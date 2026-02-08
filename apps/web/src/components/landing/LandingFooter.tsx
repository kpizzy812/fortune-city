'use client';

import { useTranslations } from 'next-intl';
import { ScrollFadeIn } from './ScrollFadeIn';

export function LandingFooter() {
  const t = useTranslations('landing');

  const scrollToAuth = () => {
    document.getElementById('hero-auth')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <footer className="relative py-20 lg:py-28 px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#ff2d95]/30 to-transparent" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ff2d95]/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto text-center">
        {/* Final CTA */}
        <ScrollFadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            {t('readyTitle')}
          </h2>
          <p className="text-[#b0b0b0] text-lg mb-8">
            {t('readySubtitle')}
          </p>
          <button
            onClick={scrollToAuth}
            className="px-10 py-4 bg-gradient-to-r from-[#ff2d95] to-[#9333ea] text-white font-bold text-lg rounded-xl hover:shadow-[0_0_30px_rgba(255,45,149,0.4)] transition-shadow"
          >
            {t('cta')}
          </button>
        </ScrollFadeIn>

        {/* Footer info */}
        <div className="mt-16 pt-8 border-t border-white/5 text-xs text-white/20">
          Fortune City &copy; {new Date().getFullYear()}
        </div>
      </div>
    </footer>
  );
}
