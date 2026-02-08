'use client';

import { useTranslations } from 'next-intl';
import { EmailLoginForm } from '@/components/auth/EmailLoginForm';
import { SolanaLoginButton } from '@/components/auth/SolanaLoginButton';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'FortuneCityAppBot';

interface AuthFormCardProps {
  compact?: boolean;
}

export function AuthFormCard({ compact = false }: AuthFormCardProps) {
  const tAuth = useTranslations('auth');

  return (
    <div className={`bg-[#2a1a4e]/40 backdrop-blur-sm rounded-2xl border border-white/10 shadow-2xl ${compact ? 'p-4' : 'p-5 lg:p-8'}`}>
      {/* Telegram — primary auth method */}
      <div className="flex justify-center mb-4">
        <TelegramLoginButton botName={TELEGRAM_BOT_NAME} />
      </div>

      {/* Divider */}
      <Divider label={tAuth('or')} />

      {/* Email Login */}
      <div className="mb-4">
        <EmailLoginForm
          onSuccess={() => {}}
          onError={(err) => console.error('Email login error:', err)}
        />
      </div>

      {/* Divider */}
      <Divider label={tAuth('or')} />

      {/* Solana Wallet Login */}
      <div>
        <SolanaLoginButton
          onSuccess={() => {}}
          onError={(err) => console.error('Solana login error:', err)}
        />
      </div>
    </div>
  );
}

function Divider({ label }: { label: string }) {
  return (
    <div className="relative my-4">
      <div className="absolute inset-0 flex items-center">
        <div className="w-full border-t border-white/10" />
      </div>
      <div className="relative flex justify-center">
        <span className="px-3 text-xs text-white/40 bg-[#2a1a4e]/40">
          {label}
        </span>
      </div>
    </div>
  );
}
