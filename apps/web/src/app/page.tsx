'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useTelegramWebApp } from '@/providers/TelegramProvider';
import { HeroSection } from '@/components/landing/HeroSection';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { LandingFooter } from '@/components/landing/LandingFooter';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { MusicToggleButton } from '@/components/layout/MusicToggleButton';

export default function LandingPage() {
  const { user, token, isLoading } = useAuthStore();
  const { isTelegramApp } = useTelegramWebApp();
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand persist hydration
  useEffect(() => {
    setHydrated(true);
  }, []);

  // Telegram Mini App — skip landing
  useEffect(() => {
    if (isTelegramApp) {
      router.replace('/app');
    }
  }, [isTelegramApp, router]);

  // Authorized user — go to dashboard
  useEffect(() => {
    if (hydrated && !isLoading && user) {
      router.replace('/app');
    }
  }, [hydrated, user, isLoading, router]);

  // Show spinner while loading, hydrating, or redirecting
  if (!hydrated || isLoading || isTelegramApp || user || token) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen">
      {/* Top controls */}
      <div className="fixed top-4 right-4 z-50 flex items-center gap-2">
        <MusicToggleButton />
        <LanguageSwitcher />
      </div>

      <HeroSection />
      <HowItWorks />
      <LandingFooter />
    </main>
  );
}
