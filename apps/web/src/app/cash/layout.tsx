'use client';

import { ReactNode } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import to avoid SSR issues with wallet adapter
const SolanaWalletProvider = dynamic(
  () => import('@/providers/SolanaWalletProvider').then((mod) => mod.SolanaWalletProvider),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen flex items-center justify-center bg-[#0d0416]">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-[#ff2d95]/30 border-t-[#ff2d95] rounded-full animate-spin" />
          <p className="text-gray-400 text-sm">Loading wallet...</p>
        </div>
      </div>
    ),
  }
);

export default function CashLayout({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
