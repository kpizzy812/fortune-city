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
        {/* Icon */}
        <div className="text-4xl flex-shrink-0">📱</div>

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
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors"
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
