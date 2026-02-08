'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

export function StickyHeader() {
  const t = useTranslations('landing');
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 100);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToLogin = () => {
    document.getElementById('hero-auth')?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#1a0a2e]/90 backdrop-blur-md border-b border-white/5 py-3'
          : 'bg-transparent py-4'
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 flex items-center justify-between">
        {/* Logo */}
        <div className="flex items-center gap-2">
          <Image
            src="/logo_transparent.png"
            alt="Fortune City"
            width={32}
            height={32}
            className="w-8 h-8"
          />
          <span className="text-white font-bold text-lg hidden sm:block">
            FORTUNE CITY
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-3">
          <LanguageSwitcher collapsed />
          <button
            onClick={scrollToLogin}
            className={`px-5 py-2 bg-gradient-to-r from-[#ff2d95] to-[#9333ea] text-white font-bold text-sm rounded-lg hover:shadow-[0_0_20px_rgba(255,45,149,0.4)] transition-all ${
              scrolled ? 'opacity-100' : 'opacity-0 pointer-events-none'
            }`}
          >
            {t('cta')}
          </button>
        </div>
      </div>
    </header>
  );
}
