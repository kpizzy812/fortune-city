'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useTelegramWebApp } from '@/providers/TelegramProvider';
import { StickyHeader } from '@/components/landing/StickyHeader';
import { HeroSection } from '@/components/landing/HeroSection';
import { SocialProof } from '@/components/landing/SocialProof';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { EarningCalculator } from '@/components/landing/EarningCalculator';
import { TrustSection } from '@/components/landing/TrustSection';
import { FAQSection } from '@/components/landing/FAQSection';
import { LandingFooter } from '@/components/landing/LandingFooter';

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
    <main className="min-h-screen overflow-x-hidden">
      <StickyHeader />
      <HeroSection />
      <SocialProof />
      <HowItWorks />
      <EarningCalculator />
      <TrustSection />
      <FAQSection />
      <LandingFooter />
    </main>
  );
}
