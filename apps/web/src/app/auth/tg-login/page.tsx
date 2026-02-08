'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { api } from '@/lib/api';

function TgLoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const token = searchParams.get('token');
    if (!token) {
      router.replace('/app');
      return;
    }

    processedRef.current = true;

    api
      .authWithTelegramBotToken(token)
      .then((response) => {
        setAuth(response.accessToken, response.user);
        router.replace('/app');
      })
      .catch((error) => {
        console.error('Telegram bot login failed:', error);
        router.replace('/app');
      });
  }, [searchParams, setAuth, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0a0015] to-[#1a0a2e]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
      <p className="mt-4 text-white/60 text-sm">Signing in...</p>
    </main>
  );
}

export default function TgLoginPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0a0015] to-[#1a0a2e]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
        </main>
      }
    >
      <TgLoginContent />
    </Suspense>
  );
}
