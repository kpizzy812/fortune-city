'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { TelegramLoginWidgetData } from '@/lib/api';

interface TelegramLoginButtonProps {
  botName: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  showUserPhoto?: boolean;
  lang?: string;
}

// Extend Window for Telegram callback
declare global {
  interface Window {
    onTelegramAuth?: (user: TelegramLoginWidgetData) => void;
  }
}

export function TelegramLoginButton({
  botName,
  onSuccess,
  onError,
  buttonSize = 'large',
  cornerRadius = 8,
  showUserPhoto = true,
  lang = 'en',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { authWithLoginWidget, isLoading } = useAuthStore();

  const handleTelegramAuth = useCallback(
    async (user: TelegramLoginWidgetData) => {
      try {
        await authWithLoginWidget(user);
        onSuccess?.();
      } catch (error) {
        onError?.(error instanceof Error ? error : new Error('Auth failed'));
      }
    },
    [authWithLoginWidget, onSuccess, onError],
  );

  useEffect(() => {
    // Set up global callback
    window.onTelegramAuth = handleTelegramAuth;

    // Create script element
    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', String(cornerRadius));
    script.setAttribute('data-onauth', 'onTelegramAuth(user)');
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-lang', lang);

    if (!showUserPhoto) {
      script.setAttribute('data-userpic', 'false');
    }

    script.async = true;

    // Append to container
    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }

    return () => {
      window.onTelegramAuth = undefined;
    };
  }, [botName, buttonSize, cornerRadius, showUserPhoto, lang, handleTelegramAuth]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff]" />
      </div>
    );
  }

  return <div ref={containerRef} className="telegram-login-button" />;
}
