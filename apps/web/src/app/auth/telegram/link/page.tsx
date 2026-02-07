'use client';

import { useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import type { TelegramLoginWidgetData } from '@/lib/api';

function TelegramLinkContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { linkTelegram } = useAuthStore();
  const processedRef = useRef(false);

  useEffect(() => {
    if (processedRef.current) return;

    const id = searchParams.get('id');
    const firstName = searchParams.get('first_name');
    const authDate = searchParams.get('auth_date');
    const hash = searchParams.get('hash');

    if (!id || !firstName || !authDate || !hash) {
      router.replace('/');
      return;
    }

    processedRef.current = true;

    const userData: TelegramLoginWidgetData = {
      id: parseInt(id, 10),
      first_name: firstName,
      last_name: searchParams.get('last_name') || undefined,
      username: searchParams.get('username') || undefined,
      photo_url: searchParams.get('photo_url') || undefined,
      auth_date: parseInt(authDate, 10),
      hash,
    };

    linkTelegram(userData)
      .then(() => {
        router.replace('/');
      })
      .catch((error) => {
        console.error('Telegram link failed:', error);
        router.replace('/');
      });
  }, [searchParams, linkTelegram, router]);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0a0015] to-[#1a0a2e]">
      <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
      <p className="mt-4 text-white/60 text-sm">Linking Telegram...</p>
    </main>
  );
}

export default function TelegramLinkPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-[#0a0015] to-[#1a0a2e]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
        </main>
      }
    >
      <TelegramLinkContent />
    </Suspense>
  );
}
