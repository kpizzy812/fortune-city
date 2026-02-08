'use client';

import { useTranslations } from 'next-intl';
import { EmailLoginForm } from '@/components/auth/EmailLoginForm';
import { SolanaLoginButton } from '@/components/auth/SolanaLoginButton';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import { useAuthStore } from '@/stores/auth.store';
import { ScrollFadeIn } from './ScrollFadeIn';

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'FortuneCityAppBot';

export function LandingFooter() {
  const t = useTranslations('landing');
  const tAuth = useTranslations('auth');

  return (
    <section id="login" className="relative py-20 lg:py-32 px-4">
      {/* Background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#ff2d95]/10 rounded-full blur-[150px]" />
      </div>

      <div className="relative z-10 max-w-md mx-auto">
        {/* Title */}
        <ScrollFadeIn className="text-center mb-10">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-3">
            {t('readyTitle')}
          </h2>
          <p className="text-[#b0b0b0] text-lg">
            {t('readySubtitle')}
          </p>
        </ScrollFadeIn>

        {/* Auth forms */}
        <ScrollFadeIn delay={0.2}>
          <div className="bg-[#2a1a4e]/40 backdrop-blur-sm rounded-2xl p-5 lg:p-8 border border-white/10 shadow-2xl">
            {/* Email Login */}
            <div className="mb-4 lg:mb-6">
              <EmailLoginForm
                onSuccess={() => {}}
                onError={(err) => console.error('Email login error:', err)}
              />
            </div>

            {/* Divider */}
            <div className="relative my-4 lg:my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-xs text-white/40 bg-[#2a1a4e]/40">
                  {tAuth('or')}
                </span>
              </div>
            </div>

            {/* Solana Wallet Login */}
            <div className="mb-4 lg:mb-6">
              <SolanaLoginButton
                onSuccess={() => {}}
                onError={(err) => console.error('Solana login error:', err)}
              />
            </div>

            {/* Divider */}
            <div className="relative my-4 lg:my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-3 text-xs text-white/40 bg-[#2a1a4e]/40">
                  {tAuth('or')}
                </span>
              </div>
            </div>

            {/* Telegram Login */}
            <div className="flex justify-center">
              <TelegramLoginButton botName={TELEGRAM_BOT_NAME} />
            </div>

            {/* Dev Login - only in development */}
            {process.env.NODE_ENV === 'development' && (
              <DevLoginButton />
            )}
          </div>
        </ScrollFadeIn>
      </div>
    </section>
  );
}

function DevLoginButton() {
  const { devLogin } = useAuthStore();
  const tAuth = useTranslations('auth');

  return (
    <button
      onClick={devLogin}
      className="w-full mt-6 px-4 py-2 text-white/60 hover:text-white/80 transition text-sm"
    >
      {tAuth('devLogin')}
    </button>
  );
}
