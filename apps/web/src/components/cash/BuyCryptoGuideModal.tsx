'use client';

import { X, Download, CreditCard, Send, ExternalLink } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { useTelegramWebApp } from '@/providers/TelegramProvider';

interface BuyCryptoGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STEPS = [
  {
    key: 'step1',
    icon: Download,
    color: '#a855f7',
    links: [
      { label: 'Phantom (iOS/Android)', url: 'https://phantom.app/download' },
      { label: 'Phantom (Chrome)', url: 'https://chrome.google.com/webstore/detail/phantom/bfnaelmomeimhlpmgjnjophhpkkoljpa' },
    ],
  },
  {
    key: 'step2',
    icon: CreditCard,
    color: '#22c55e',
    links: [
      { label: 'BestChange', url: 'https://www.bestchange.ru/' },
      { label: 'CryptoBot', url: 'https://t.me/CryptoBot' },
      { label: 'Bybit', url: 'https://www.bybit.com/' },
    ],
  },
  {
    key: 'step3',
    icon: Send,
    color: '#00d4ff',
    links: [],
  },
  {
    key: 'step4',
    icon: ExternalLink,
    color: '#ffd700',
    links: [],
  },
];

export function BuyCryptoGuideModal({ isOpen, onClose }: BuyCryptoGuideModalProps) {
  const t = useTranslations('cash');
  const { isTelegramApp, webApp } = useTelegramWebApp();

  const handleOpenLink = (url: string) => {
    if (isTelegramApp && webApp) {
      if (url.startsWith('https://t.me/')) {
        webApp.openTelegramLink(url);
      } else {
        webApp.openLink(url);
      }
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Modal */}
          <motion.div
            className="relative w-full max-w-lg max-h-[85vh] overflow-y-auto bg-[#1a0a2e] border border-[#ff2d95]/30 rounded-t-2xl sm:rounded-2xl p-5"
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Close button */}
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Title */}
            <h2 className="text-lg font-bold text-white mb-1">
              {t('buyCryptoTitle')}
            </h2>
            <p className="text-xs text-white/50 mb-5">
              {t('buyCryptoSubtitle')}
            </p>

            {/* Steps */}
            <div className="space-y-4">
              {STEPS.map((step, index) => {
                const Icon = step.icon;
                return (
                  <div
                    key={step.key}
                    className="bg-white/5 rounded-xl p-4 border border-white/10"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ backgroundColor: `${step.color}20` }}
                      >
                        <Icon className="w-4 h-4" style={{ color: step.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-white/40 uppercase">
                            {t('buyCryptoStepLabel', { num: index + 1 })}
                          </span>
                        </div>
                        <h3 className="text-sm font-semibold text-white mb-1">
                          {t(`${step.key}Title`)}
                        </h3>
                        <p className="text-xs text-white/60 leading-relaxed">
                          {t(`${step.key}Desc`)}
                        </p>

                        {/* Links */}
                        {step.links.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {step.links.map((link) => (
                              <button
                                key={link.url}
                                onClick={() => handleOpenLink(link.url)}
                                className="text-[11px] px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-white/80 hover:text-white transition-colors"
                              >
                                {link.label} ↗
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Warning */}
            <div className="mt-4 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
              <p className="text-[11px] text-amber-200/80 leading-relaxed">
                {t('buyCryptoWarning')}
              </p>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
