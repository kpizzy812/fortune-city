'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useTranslations } from 'next-intl';

interface SolanaLoginButtonProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export function SolanaLoginButton({
  onSuccess,
  onError,
}: SolanaLoginButtonProps) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isMounted, setIsMounted] = useState(false);
  const [isSolanaAvailable, setIsSolanaAvailable] = useState(false);
  const { signInWithWeb3, isLoading } = useAuthStore();
  const t = useTranslations('auth');

  // Проверяем доступность Solana wallet после монтирования на клиенте
  useEffect(() => {
    setIsMounted(true);
    setIsSolanaAvailable(
      typeof window !== 'undefined' && window.solana !== undefined,
    );
  }, []);

  const handleConnect = async () => {
    // Проверяем наличие Solana wallet
    if (typeof window === 'undefined' || !window.solana) {
      onError?.(new Error(t('walletNotFound')));
      return;
    }

    setIsConnecting(true);
    try {
      // Сначала подключаем кошелёк
      await window.solana.connect();

      // Затем авторизуемся через Supabase Web3
      await signInWithWeb3();

      onSuccess?.();
    } catch (err) {
      onError?.(
        err instanceof Error ? err : new Error('Failed to connect wallet'),
      );
    } finally {
      setIsConnecting(false);
    }
  };

  // Показываем placeholder пока компонент не смонтирован (для SSR)
  if (!isMounted) {
    return (
      <button
        disabled
        className="w-full py-3 bg-gradient-to-r from-[#9945FF] to-[#14F195]
                   text-white font-bold rounded-lg opacity-50 cursor-not-allowed
                   flex items-center justify-center gap-2"
      >
        {t('connectWallet')}
      </button>
    );
  }

  if (!isSolanaAvailable) {
    return (
      <div className="text-center p-6 bg-[#2a1a4e] rounded-xl border border-[#ff2d95]/30">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-bold text-white mb-2">
          {t('walletNotFound')}
        </h3>
        <p className="text-[#b0b0b0] text-sm">{t('installWallet')}</p>
        <a
          href="https://phantom.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-4 inline-block text-[#00d4ff] hover:underline transition"
        >
          Install Phantom Wallet →
        </a>
      </div>
    );
  }

  return (
    <button
      onClick={handleConnect}
      disabled={isConnecting || isLoading}
      className="w-full py-3 bg-gradient-to-r from-[#9945FF] to-[#14F195]
                 text-white font-bold rounded-lg hover:opacity-90 transition
                 disabled:opacity-50 disabled:cursor-not-allowed
                 flex items-center justify-center gap-2"
    >
      {isConnecting || isLoading ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
          {t('connecting')}
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            viewBox="0 0 397.7 311.7"
            fill="currentColor"
          >
            <linearGradient
              id="a"
              gradientUnits="userSpaceOnUse"
              x1="360.879"
              y1="351.455"
              x2="141.213"
              y2="-69.294"
              gradientTransform="matrix(1 0 0 -1 0 314)"
            >
              <stop offset="0" stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
            <path
              d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"
              fill="url(#a)"
            />
            <linearGradient
              id="b"
              gradientUnits="userSpaceOnUse"
              x1="264.829"
              y1="401.601"
              x2="45.163"
              y2="-19.148"
              gradientTransform="matrix(1 0 0 -1 0 314)"
            >
              <stop offset="0" stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
            <path
              d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"
              fill="url(#b)"
            />
            <linearGradient
              id="c"
              gradientUnits="userSpaceOnUse"
              x1="312.548"
              y1="376.688"
              x2="92.882"
              y2="-44.061"
              gradientTransform="matrix(1 0 0 -1 0 314)"
            >
              <stop offset="0" stopColor="#00FFA3" />
              <stop offset="1" stopColor="#DC1FFF" />
            </linearGradient>
            <path
              d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"
              fill="url(#c)"
            />
          </svg>
          {t('connectWallet')}
        </>
      )}
    </button>
  );
}
