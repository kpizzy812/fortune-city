'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useTranslations } from 'next-intl';
import { isMobileBrowser, openInPhantom } from '@/lib/mobile-detect';

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
  const [isMobile, setIsMobile] = useState(false);
  const { signInWithWeb3, isLoading } = useAuthStore();
  const t = useTranslations('auth');

  // Проверяем доступность Solana wallet после монтирования на клиенте
  useEffect(() => {
    setIsMounted(true);
    setIsSolanaAvailable(
      typeof window !== 'undefined' && window.solana !== undefined,
    );
    setIsMobile(isMobileBrowser());
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
      // Проверяем тип ошибки
      const errorMessage =
        err instanceof Error ? err.message : String(err);

      // Если пользователь отменил подключение - игнорируем (не показываем ошибку)
      if (
        errorMessage.includes('User rejected') ||
        errorMessage.includes('user rejected') ||
        errorMessage.includes('User declined') ||
        errorMessage.includes('cancelled')
      ) {
        console.log('User cancelled wallet connection');
        return; // Просто выходим, не вызываем onError
      }

      // Для всех других ошибок показываем сообщение
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
    // Мобильный — предлагаем открыть в Phantom + установить
    if (isMobile) {
      return (
        <div className="space-y-3">
          <button
            onClick={() => openInPhantom()}
            className="w-full py-3 bg-gradient-to-r from-[#AB9FF2] to-[#8b5cf6]
                       text-white font-bold rounded-lg hover:opacity-90 transition
                       flex items-center justify-center gap-2"
          >
            <svg className="w-5 h-5" viewBox="0 0 128 128" fill="none">
              <circle cx="64" cy="64" r="64" fill="white" fillOpacity="0.15" />
              <path d="M110.584 64.9142H99.142C99.142 41.7651 80.173 23 56.7724 23C33.6612 23 14.8716 41.3057 14.4118 64.0026C13.936 87.4478 33.5467 107.516 57.2037 107H62.1363C83.2743 107 110.584 89.1628 110.584 64.9142Z" fill="white" />
              <circle cx="44.5" cy="57.5" r="5.5" fill="#AB9FF2" />
              <circle cx="66.5" cy="57.5" r="5.5" fill="#AB9FF2" />
            </svg>
            {t('openInPhantom')}
          </button>
          <a
            href="https://phantom.app/download"
            target="_blank"
            rel="noopener noreferrer"
            className="block w-full py-2.5 text-center bg-white/5 hover:bg-white/10 border border-white/10
                       text-white/60 hover:text-white rounded-lg transition text-sm"
          >
            {t('installPhantom')}
          </a>
        </div>
      );
    }

    // Десктоп — предлагаем установить расширение
    return (
      <div className="text-center py-4">
        <div className="text-4xl mb-3">🔒</div>
        <h3 className="text-lg font-semibold text-white mb-2">
          {t('walletNotFound')}
        </h3>
        <p className="text-sm text-[#b0b0b0] mb-4">{t('installWallet')}</p>
        <a
          href="https://phantom.app/"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-6 py-2 bg-white/5 hover:bg-white/10 border border-white/10
                     text-white/80 hover:text-white rounded-lg transition text-sm"
        >
          Install Phantom →
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
