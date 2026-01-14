'use client';

import { ReactNode } from 'react';
import { SolanaWalletProvider } from '@/providers/SolanaWalletProvider';

export default function CashLayout({ children }: { children: ReactNode }) {
  return <SolanaWalletProvider>{children}</SolanaWalletProvider>;
}
