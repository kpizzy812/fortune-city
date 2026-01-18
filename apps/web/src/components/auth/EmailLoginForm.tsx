'use client';

import { useState, FormEvent } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useTranslations } from 'next-intl';

interface EmailLoginFormProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function EmailLoginForm({ onSuccess, onError }: EmailLoginFormProps) {
  const [email, setEmail] = useState('');
  const [isSent, setIsSent] = useState(false);
  const { sendMagicLink, isLoading, error } = useAuthStore();
  const t = useTranslations('auth');

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await sendMagicLink(email);
      setIsSent(true);
      onSuccess?.();
    } catch (err) {
      onError?.(
        err instanceof Error ? err : new Error('Failed to send magic link'),
      );
    }
  };

  if (isSent) {
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">✉️</div>
        <h3 className="text-lg font-semibold text-white mb-2">{t('checkEmail')}</h3>
        <p className="text-sm text-[#b0b0b0] mb-1">
          {t('magicLinkSent')}
        </p>
        <p className="text-[#00d4ff] text-sm font-medium mb-3">{email}</p>
        <p className="text-xs text-[#b0b0b0] mb-4">{t('clickToSignIn')}</p>
        <button
          onClick={() => setIsSent(false)}
          className="text-sm text-white/60 hover:text-white/80 transition"
        >
          ← {t('useDifferentEmail')}
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="email" className="block text-sm text-[#b0b0b0] mb-2">
          Email
        </label>
        <input
          type="email"
          id="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          required
          className="w-full px-4 py-3 bg-[#1a0a2e] border border-[#ff2d95]/30 rounded-lg
                     text-white placeholder-[#666] focus:outline-none focus:border-[#00d4ff]
                     transition"
        />
      </div>

      {error && <p className="text-[#ff4444] text-sm">{error}</p>}

      <button
        type="submit"
        disabled={isLoading || !email}
        className="w-full py-3 bg-gradient-to-r from-[#ff2d95] to-[#00d4ff]
                   text-white font-bold rounded-lg hover:opacity-90 transition
                   disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? t('sending') : t('sendMagicLink')}
      </button>
    </form>
  );
}
