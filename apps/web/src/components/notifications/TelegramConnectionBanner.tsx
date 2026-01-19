'use client';

import { useState } from 'react';
import { useAuthStore } from '@/stores/auth.store';

export function TelegramConnectionBanner() {
  const { user } = useAuthStore();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show if:
  // - User is not logged in
  // - Telegram notifications already enabled
  // - User dismissed the banner
  // - User doesn't have telegramId (email/web3 auth only)
  if (
    !user ||
    user.telegramNotificationsEnabled ||
    isDismissed ||
    !user.telegramId
  ) {
    return null;
  }

  const botUsername = process.env.NEXT_PUBLIC_TELEGRAM_BOT_USERNAME || 'FortuneCity_bot';
  const deepLink = `https://t.me/${botUsername}?start=connect_${user.id}`;

  return (
    <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 border border-blue-700/50 rounded-lg p-4 mb-4">
      <div className="flex items-start gap-4">
        {/* Telegram Icon */}
        <div className="flex-shrink-0">
          <svg className="w-10 h-10" viewBox="0 0 24 24" fill="#0088cc">
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm4.64 6.8c-.15 1.58-.8 5.42-1.13 7.19-.14.75-.42 1-.68 1.03-.58.05-1.02-.38-1.58-.75-.88-.58-1.38-.94-2.23-1.5-.99-.65-.35-1.01.22-1.59.15-.15 2.71-2.48 2.76-2.69a.2.2 0 00-.05-.18c-.06-.05-.14-.03-.21-.02-.09.02-1.49.95-4.22 2.79-.4.27-.76.41-1.08.4-.36-.01-1.04-.2-1.55-.37-.63-.2-1.12-.31-1.08-.66.02-.18.27-.36.74-.55 2.92-1.27 4.86-2.11 5.83-2.51 2.78-1.16 3.35-1.36 3.73-1.36.08 0 .27.02.39.12.1.08.13.19.14.27-.01.06.01.24 0 .38z"/>
          </svg>
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="text-lg font-bold text-white mb-1">
            Enable Telegram Notifications
          </h3>
          <p className="text-sm text-gray-300 mb-3">
            Get instant notifications about deposits, withdrawals, machine status, and more directly in Telegram!
          </p>

          <div className="flex gap-2">
            <a
              href={deepLink}
              target="_blank"
              rel="noopener noreferrer"
              className="px-4 py-2 bg-[#0088cc] hover:bg-[#0088cc]/80 text-white rounded-lg text-sm font-semibold transition-colors"
            >
              Connect Telegram Bot
            </a>
            <button
              onClick={() => setIsDismissed(true)}
              className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>

        {/* Close button */}
        <button
          onClick={() => setIsDismissed(true)}
          className="text-gray-400 hover:text-white transition-colors flex-shrink-0"
          aria-label="Close"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
