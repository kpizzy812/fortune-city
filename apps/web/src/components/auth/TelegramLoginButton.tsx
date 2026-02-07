'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';

interface TelegramLoginButtonProps {
  botName: string;
  buttonSize?: 'large' | 'medium' | 'small';
  cornerRadius?: number;
  showUserPhoto?: boolean;
  lang?: string;
}

export function TelegramLoginButton({
  botName,
  buttonSize = 'large',
  cornerRadius = 8,
  showUserPhoto = true,
  lang = 'en',
}: TelegramLoginButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { isLoading } = useAuthStore();

  useEffect(() => {
    const authUrl = `${window.location.origin}/auth/telegram/callback`;

    const script = document.createElement('script');
    script.src = 'https://telegram.org/js/telegram-widget.js?22';
    script.setAttribute('data-telegram-login', botName);
    script.setAttribute('data-size', buttonSize);
    script.setAttribute('data-radius', String(cornerRadius));
    script.setAttribute('data-auth-url', authUrl);
    script.setAttribute('data-request-access', 'write');
    script.setAttribute('data-lang', lang);

    if (!showUserPhoto) {
      script.setAttribute('data-userpic', 'false');
    }

    script.async = true;

    if (containerRef.current) {
      containerRef.current.innerHTML = '';
      containerRef.current.appendChild(script);
    }
  }, [botName, buttonSize, cornerRadius, showUserPhoto, lang]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#00d4ff]" />
      </div>
    );
  }

  return <div ref={containerRef} className="telegram-login-button" />;
}
