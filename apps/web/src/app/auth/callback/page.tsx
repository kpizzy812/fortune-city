'use client';

import { useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { getReferralCode } from '@/lib/referral';

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { handleSupabaseCallback, isLoading, error } = useAuthStore();

  useEffect(() => {
    // Сохраняем referral code если есть в URL
    const ref = searchParams.get('ref');
    if (ref && typeof window !== 'undefined') {
      localStorage.setItem('fortune-city-referral-code', ref);
    }

    // Обрабатываем callback
    handleSupabaseCallback()
      .then(() => {
        router.replace('/');
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
            Ошибка авторизации
          </h1>
          <p className="text-[#b0b0b0] mb-6">{error}</p>
          <button
            onClick={() => router.replace('/')}
            className="px-6 py-3 bg-[#ff2d95] text-white rounded-lg hover:bg-[#ff2d95]/80 transition"
          >
            Попробовать снова
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
      <p className="mt-4 text-[#b0b0b0]">Завершаем вход...</p>
    </main>
  );
}
