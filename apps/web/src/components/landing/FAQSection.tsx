'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollFadeIn } from './ScrollFadeIn';

const FAQ_KEYS = ['faq1', 'faq2', 'faq3', 'faq4', 'faq5', 'faq6', 'faq7', 'faq8'] as const;

export function FAQSection() {
  const t = useTranslations('landing');
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <section className="relative py-20 lg:py-28 px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[#9333ea]/30 to-transparent" />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto">
        {/* Section title */}
        <ScrollFadeIn className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold text-white mb-4">
            {t('faqTitle')}
          </h2>
          <div className="w-20 h-1 bg-gradient-to-r from-[#9333ea] to-[#ff2d95] rounded-full mx-auto" />
        </ScrollFadeIn>

        {/* Accordion */}
        <ScrollFadeIn delay={0.2}>
          <div className="space-y-3">
            {FAQ_KEYS.map((key, i) => {
              const isOpen = openIndex === i;
              return (
                <div
                  key={key}
                  className={`bg-[#1a0a2e]/60 backdrop-blur-sm border rounded-xl overflow-hidden transition-colors duration-200 ${
                    isOpen ? 'border-white/20' : 'border-white/10'
                  }`}
                >
                  <button
                    onClick={() => setOpenIndex(isOpen ? null : i)}
                    className="w-full flex items-center justify-between p-5 text-left"
                  >
                    <span className="text-white font-medium pr-4">
                      {t(`${key}Q`)}
                    </span>
                    <motion.div
                      animate={{ rotate: isOpen ? 180 : 0 }}
                      transition={{ duration: 0.2 }}
                      className="shrink-0"
                    >
                      <ChevronDown className="w-5 h-5 text-white/40" />
                    </motion.div>
                  </button>

                  <AnimatePresence>
                    {isOpen && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <div className="px-5 pb-5 text-sm text-[#b0b0b0] leading-relaxed">
                          {t(`${key}A`)}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  );
}
