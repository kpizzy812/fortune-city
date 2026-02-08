'use client';

import Image from 'next/image';
import { useTranslations } from 'next-intl';
import { motion } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { AuthFormCard } from './AuthFormCard';

export function HeroSection() {
  const t = useTranslations('landing');
  const tBrand = useTranslations('brand');

  return (
    <section className="relative min-h-screen flex items-center px-4 pt-20 pb-12 overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 -left-32 w-96 h-96 bg-[#ff2d95]/15 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 -right-32 w-96 h-96 bg-[#00d4ff]/15 rounded-full blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[#9333ea]/10 rounded-full blur-[150px]" />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
          }}
        />
      </div>

      {/* Two-column layout */}
      <div className="relative z-10 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
        {/* Left column — value proposition */}
        <div className="text-center lg:text-left">
          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.6 }}
            className="flex items-center justify-center lg:justify-start gap-3 mb-6"
          >
            <Image
              src="/logo_transparent.png"
              alt={tBrand('name')}
              width={64}
              height={64}
              className="drop-shadow-[0_0_20px_rgba(255,45,149,0.4)]"
              priority
            />
          </motion.div>

          {/* Title */}
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent mb-5 leading-tight"
          >
            {t('heroTitle')}
          </motion.h1>

          {/* Subtitle */}
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="text-lg sm:text-xl text-[#b0b0b0] mb-8 max-w-xl mx-auto lg:mx-0 leading-relaxed"
          >
            {t('heroSubtitle')}
          </motion.p>

          {/* Value props pills */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.45 }}
            className="flex flex-wrap justify-center lg:justify-start gap-3 mb-8"
          >
            <ValuePill text={t('heroPill1')} />
            <ValuePill text={t('heroPill2')} />
            <ValuePill text={t('heroPill3')} />
          </motion.div>

          {/* Machine showcase */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.6 }}
            className="flex items-end justify-center lg:justify-start gap-3 sm:gap-4"
          >
            {[1, 3, 5, 7, 10].map((tier, i) => (
              <motion.div
                key={tier}
                animate={{ y: [0, -6, 0] }}
                transition={{
                  duration: 3,
                  repeat: Infinity,
                  delay: i * 0.4,
                  ease: 'easeInOut',
                }}
              >
                <Image
                  src={`/machines/tier-${tier}.png`}
                  alt={`Tier ${tier}`}
                  width={i === 2 ? 72 : 52}
                  height={i === 2 ? 72 : 52}
                  className={`drop-shadow-[0_0_12px_rgba(255,45,149,0.3)] ${
                    i === 2 ? 'w-14 sm:w-[72px]' : 'w-10 sm:w-[52px]'
                  }`}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>

        {/* Right column — auth form */}
        <motion.div
          id="hero-auth"
          initial={{ opacity: 0, x: 30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="w-full max-w-md mx-auto lg:mx-0 lg:ml-auto scroll-mt-24"
        >
          <AuthFormCard />
        </motion.div>
      </div>

      {/* Scroll indicator — desktop only */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 hidden lg:block"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <ChevronDown className="w-6 h-6 text-white/30" />
        </motion.div>
      </motion.div>
    </section>
  );
}

function ValuePill({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 border border-white/10 rounded-full text-sm text-white/70">
      <span className="w-1.5 h-1.5 rounded-full bg-[#00ff88]" />
      {text}
    </span>
  );
}
