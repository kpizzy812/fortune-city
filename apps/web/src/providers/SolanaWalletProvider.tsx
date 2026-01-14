'use client';

import { FC, ReactNode, useMemo, useCallback } from 'react';
import {
  ConnectionProvider,
  WalletProvider,
} from '@solana/wallet-adapter-react';
import { WalletModalProvider } from '@solana/wallet-adapter-react-ui';
import { WalletAdapterNetwork } from '@solana/wallet-adapter-base';
import type { WalletError, Adapter } from '@solana/wallet-adapter-base';
import { clusterApiUrl } from '@solana/web3.js';

// Default styles
import '@solana/wallet-adapter-react-ui/styles.css';

interface SolanaWalletProviderProps {
  children: ReactNode;
}

export const SolanaWalletProvider: FC<SolanaWalletProviderProps> = ({
  children,
}) => {
  // Network configuration - use mainnet for production
  const network = WalletAdapterNetwork.Mainnet;
  const endpoint = useMemo(() => {
    // Use custom RPC if provided, otherwise use public endpoint
    const customRpc = process.env.NEXT_PUBLIC_SOLANA_RPC_URL;
    return customRpc || clusterApiUrl(network);
  }, [network]);

  // Wallets - modern wallets are auto-detected via Wallet Standard
  const wallets = useMemo<Adapter[]>(() => [], []);

  // Error handler
  const onError = useCallback((error: WalletError, adapter?: Adapter) => {
    console.error('Wallet error:', error.message, adapter?.name);
  }, []);

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={wallets} onError={onError} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
};
