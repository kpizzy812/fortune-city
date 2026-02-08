'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleSupabaseCallback, error } = useAuthStore();
  const t = useTranslations('auth');
  const tCommon = useTranslations('common');

  useEffect(() => {
    // Сохраняем referral code если есть в URL
    const ref = searchParams.get('ref');
    if (ref && typeof window !== 'undefined') {
      localStorage.setItem('fortune-city-referral-code', ref);
    }

    // Получаем action параметр (link-email для привязки email)
    const action = searchParams.get('action') || undefined;

    // Обрабатываем callback
    handleSupabaseCallback(action)
      .then(() => {
        router.replace('/app');
      })
      .catch((err) => {
        console.error('Auth callback error:', err);
      });
  }, [handleSupabaseCallback, router, searchParams]);

  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold text-[#ff2d95] mb-4">
            {t('authError')}
          </h1>
          <p className="text-[#b0b0b0] mb-6">{error}</p>
          <button
            onClick={() => router.replace('/app')}
            className="px-6 py-3 bg-[#ff2d95] text-white rounded-lg hover:bg-[#ff2d95]/80 transition"
          >
            {tCommon('tryAgain')}
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
      <p className="mt-4 text-[#b0b0b0]">{tCommon('loading')}</p>
    </main>
  );
}
