'use client';

import { useEffect, ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';

interface TelegramProviderProps {
  children: ReactNode;
}

// Extend Window interface for Telegram WebApp
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        initDataUnsafe: {
          user?: {
            id: number;
            first_name?: string;
            last_name?: string;
            username?: string;
          };
        };
        ready: () => void;
        expand: () => void;
        close: () => void;
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          setText: (text: string) => void;
          enable: () => void;
          disable: () => void;
          showProgress: (leaveActive?: boolean) => void;
          hideProgress: () => void;
        };
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        themeParams: {
          bg_color?: string;
          text_color?: string;
          hint_color?: string;
          link_color?: string;
          button_color?: string;
          button_text_color?: string;
          secondary_bg_color?: string;
        };
        colorScheme: 'light' | 'dark';
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        platform: string;
        version: string;
      };
    };
  }
}

export function TelegramProvider({ children }: TelegramProviderProps) {
  const { token, authWithInitData, refreshUser } = useAuthStore();

  useEffect(() => {
    const webApp = window.Telegram?.WebApp;

    if (webApp) {
      // Signal that the app is ready
      webApp.ready();

      // Expand to full height
      webApp.expand();

      // Auto-authenticate if we have initData and no token
      if (webApp.initData && !token) {
        authWithInitData(webApp.initData).catch((error) => {
          console.error('Telegram auth failed:', error);
        });
      }
    }

    // Refresh user data if we have a token
    if (token) {
      refreshUser();
    }
  }, [token, authWithInitData, refreshUser]);

  return <>{children}</>;
}

// Hook to check if running in Telegram Mini App
export function useTelegramWebApp() {
  const webApp = typeof window !== 'undefined' ? window.Telegram?.WebApp : undefined;

  return {
    webApp,
    isTelegramApp: !!webApp?.initData,
    user: webApp?.initDataUnsafe.user,
    colorScheme: webApp?.colorScheme || 'dark',
    platform: webApp?.platform || 'unknown',
  };
}
