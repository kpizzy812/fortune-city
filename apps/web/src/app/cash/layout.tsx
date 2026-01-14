'use client';

import { ReactNode, Suspense } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with wallet adapter
const SolanaWalletProvider = dynamic(
  () => import('@/providers/SolanaWalletProvider').then((mod) => mod.SolanaWalletProvider),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin" />
      </div>
    ),
  }
);

export default function CashLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin" />
      </div>
    }>
      <SolanaWalletProvider>{children}</SolanaWalletProvider>
    </Suspense>
  );
}
