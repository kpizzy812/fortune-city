'use client';

import { type ReactNode, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useTelegramWebApp } from '@/providers/TelegramProvider';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, token, isLoading } = useAuthStore();
  const { isTelegramApp } = useTelegramWebApp();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand persist hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Redirect to landing if not authenticated (and not in TMA which auto-auths)
  useEffect(() => {
    if (!hydrated) return;
    if (isLoading) return;
    if (!user && !token && !isTelegramApp) {
      router.replace('/');
    }
  }, [hydrated, user, token, isLoading, isTelegramApp, router]);

  // Show spinner while loading or hydrating
  if (!hydrated || isLoading || (!user && (isTelegramApp || token))) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
      </main>
    );
  }

  // Not authenticated — waiting for redirect
  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
      </main>
    );
  }

  return <AuthenticatedLayout>{children}</AuthenticatedLayout>;
}
