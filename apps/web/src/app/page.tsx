'use client';

import { useAuthStore } from '@/stores/auth.store';
import { useTelegramWebApp } from '@/providers/TelegramProvider';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'FortuneCityBot';

export default function Home() {
  const { user, isLoading, error, clearAuth } = useAuthStore();
  const { isTelegramApp } = useTelegramWebApp();

  // Show loading state
  if (isLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
        <p className="mt-4 text-[#b0b0b0]">Loading...</p>
      </main>
    );
  }

  // Show auth error
  if (error) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#ff2d95] mb-4">Auth Error</h1>
          <p className="text-[#b0b0b0] mb-6">{error}</p>
          <button
            onClick={clearAuth}
            className="px-6 py-3 bg-[#ff2d95] text-white rounded-lg hover:bg-[#ff2d95]/80 transition"
          >
            Try Again
          </button>
        </div>
      </main>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center max-w-md">
          {/* Logo */}
          <div className="mb-8">
            <h1 className="text-5xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
              FORTUNE CITY
            </h1>
            <p className="text-[#ffd700] mt-2 text-lg italic">
              Spin your fortune. Own the floor.
            </p>
          </div>

          {/* Description */}
          <p className="text-[#b0b0b0] mb-8">
            Build your slot machine empire in the neon-lit streets of Fortune City.
            Buy machines, collect coins, and become the king of the floor.
          </p>

          {/* Login */}
          {isTelegramApp ? (
            <p className="text-[#00d4ff]">Authenticating with Telegram...</p>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <p className="text-[#b0b0b0] text-sm mb-2">
                Sign in with Telegram to start playing
              </p>
              <TelegramLoginButton
                botName={TELEGRAM_BOT_NAME}
                onSuccess={() => console.log('Login success')}
                onError={(err) => console.error('Login error:', err)}
              />
            </div>
          )}
        </div>
      </main>
    );
  }

  // Show authenticated dashboard
  return (
    <main className="min-h-screen p-4">
      {/* Header */}
      <header className="flex items-center justify-between p-4 mb-6">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
          FORTUNE CITY
        </h1>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-[#b0b0b0]">$FORTUNE</p>
            <p className="text-[#ffd700] font-mono">
              ${parseFloat(user.fortuneBalance).toFixed(2)}
            </p>
          </div>
          <button
            onClick={clearAuth}
            className="px-3 py-1 text-sm border border-[#ff2d95] text-[#ff2d95] rounded hover:bg-[#ff2d95]/10 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* User Info Card */}
      <div className="bg-[#2a1a4e] rounded-xl p-6 border border-[#ff2d95]/30 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#ff2d95] to-[#00d4ff] flex items-center justify-center text-2xl font-bold">
            {user.firstName?.[0] || user.username?.[0] || '?'}
          </div>
          <div>
            <h2 className="text-xl font-semibold">
              {user.firstName} {user.lastName}
            </h2>
            {user.username && (
              <p className="text-[#00d4ff]">@{user.username}</p>
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="bg-[#1a0a2e] rounded-lg p-4">
            <p className="text-sm text-[#b0b0b0]">$FORTUNE</p>
            <p className="text-xl font-mono text-[#ffd700]">
              ${parseFloat(user.fortuneBalance).toFixed(2)}
            </p>
          </div>
          <div className="bg-[#1a0a2e] rounded-lg p-4">
            <p className="text-sm text-[#b0b0b0]">Max Tier</p>
            <p className="text-xl font-mono text-[#ff2d95]">
              {user.maxTierReached || '-'}
            </p>
          </div>
          <div className="bg-[#1a0a2e] rounded-lg p-4">
            <p className="text-sm text-[#b0b0b0]">Tax Rate</p>
            <p className="text-xl font-mono text-white">
              {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      {/* Placeholder for machines */}
      <div className="bg-[#2a1a4e] rounded-xl p-6 border border-[#00d4ff]/30">
        <h3 className="text-lg font-semibold mb-4 text-[#00d4ff]">
          Your Machines
        </h3>
        <div className="text-center py-12 text-[#b0b0b0]">
          <p className="text-4xl mb-4">🎰</p>
          <p>No machines yet.</p>
          <p className="text-sm mt-2">Buy your first slot machine to start earning!</p>
          <button className="mt-6 px-6 py-3 bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] text-white font-semibold rounded-lg hover:opacity-90 transition">
            Visit Shop
          </button>
        </div>
      </div>
    </main>
  );
}
