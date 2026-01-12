'use client';

import { useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useMachinesStore } from '@/stores/machines.store';
import { useTelegramWebApp } from '@/providers/TelegramProvider';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import { MachineGrid } from '@/components/machines/MachineGrid';
import { useInterval } from '@/hooks/useInterval';

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'FortuneCityBot';

// Refresh server data every 30 seconds
const SERVER_REFRESH_INTERVAL = 30000;
// Interpolate income every second
const INCOME_INTERPOLATION_INTERVAL = 1000;

export default function Home() {
  const { user, token, isLoading: authLoading, error: authError, clearAuth, refreshUser, devLogin } = useAuthStore();
  const { isTelegramApp } = useTelegramWebApp();

  const {
    machines,
    incomes,
    isLoadingMachines,
    isCollecting,
    error: machinesError,
    fetchMachines,
    fetchAllIncomes,
    collectCoins,
    interpolateAllIncomes,
    clearError,
  } = useMachinesStore();

  // Track if initial fetch was done
  const hasFetchedMachines = useRef(false);
  const hasFetchedIncomes = useRef(false);

  // Load machines when authenticated (only once)
  useEffect(() => {
    if (token && user && !hasFetchedMachines.current) {
      hasFetchedMachines.current = true;
      fetchMachines(token, 'active');
    }
  }, [token, user, fetchMachines]);

  // Fetch income for all machines after machines are loaded (only once)
  useEffect(() => {
    if (token && machines.length > 0 && !hasFetchedIncomes.current) {
      hasFetchedIncomes.current = true;
      fetchAllIncomes(token);
    }
  }, [token, machines.length, fetchAllIncomes]);

  // Client-side income interpolation every second
  useInterval(() => {
    if (machines.length > 0) {
      interpolateAllIncomes();
    }
  }, user ? INCOME_INTERPOLATION_INTERVAL : null);

  // Server sync every 30 seconds
  useInterval(() => {
    if (token && machines.length > 0) {
      fetchAllIncomes(token);
      refreshUser();
    }
  }, user ? SERVER_REFRESH_INTERVAL : null);

  // Handle collect
  const handleCollect = useCallback(
    async (machineId: string) => {
      if (!token) return;
      try {
        await collectCoins(token, machineId);
        // Refresh user balance
        refreshUser();
      } catch {
        // Error is handled in store
      }
    },
    [token, collectCoins, refreshUser]
  );

  // Show loading state
  if (authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
        <p className="mt-4 text-[#b0b0b0]">Loading...</p>
      </main>
    );
  }

  // Show auth error
  if (authError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#ff2d95] mb-4">Auth Error</h1>
          <p className="text-[#b0b0b0] mb-6">{authError}</p>
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

              {/* Dev Login - only in development */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={devLogin}
                  className="mt-4 px-6 py-2 bg-[#2a1a4e] border border-[#ff2d95]/50 text-[#ff2d95] rounded-lg hover:bg-[#ff2d95]/10 transition text-sm"
                >
                  Dev Login (Test User)
                </button>
              )}
            </div>
          )}
        </div>
      </main>
    );
  }

  // Show authenticated dashboard
  return (
    <main className="min-h-screen p-4 lg:p-8">
      {/* Container with max-width for desktop */}
      <div className="max-w-6xl mx-auto">
        {/* Header - visible only on mobile (on desktop it's in sidebar) */}
        <header className="flex items-center justify-between mb-6 lg:hidden">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
            FORTUNE CITY
          </h1>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="text-xs text-[#b0b0b0]">$FORTUNE</p>
              <p className="text-lg text-[#ffd700] font-mono font-bold">
                ${parseFloat(user.fortuneBalance).toFixed(2)}
              </p>
            </div>
            <button
              onClick={clearAuth}
              className="p-2 text-[#b0b0b0] hover:text-white transition"
              title="Logout"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        </header>

        {/* Desktop page title */}
        <div className="hidden lg:block mb-8">
          <h2 className="text-3xl font-bold text-white mb-2">Dashboard</h2>
          <p className="text-[#b0b0b0]">Manage your slot machine empire</p>
        </div>

        {/* User Stats Card - visible only on mobile (on desktop it's in sidebar) */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30 mb-6 lg:hidden">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-[#ff2d95] to-[#00d4ff] flex items-center justify-center text-xl font-bold">
              {user.firstName?.[0] || user.username?.[0] || '?'}
            </div>
            <div>
              <h2 className="font-semibold text-white">
                {user.firstName} {user.lastName}
              </h2>
              {user.username && (
                <p className="text-sm text-[#00d4ff]">@{user.username}</p>
              )}
            </div>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[#1a0a2e] rounded-lg p-3 text-center">
              <p className="text-xs text-[#b0b0b0]">Machines</p>
              <p className="text-lg font-mono text-white">{machines.length}</p>
            </div>
            <div className="bg-[#1a0a2e] rounded-lg p-3 text-center">
              <p className="text-xs text-[#b0b0b0]">Max Tier</p>
              <p className="text-lg font-mono text-[#ff2d95]">
                {user.maxTierReached || '-'}
              </p>
            </div>
            <div className="bg-[#1a0a2e] rounded-lg p-3 text-center">
              <p className="text-xs text-[#b0b0b0]">Tax</p>
              <p className="text-lg font-mono text-white">
                {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Stats Bar */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">Total Machines</p>
            <p className="text-2xl font-mono font-bold text-white">{machines.length}</p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">Max Tier Reached</p>
            <p className="text-2xl font-mono font-bold text-[#ff2d95]">{user.maxTierReached || '-'}</p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">Current Tax Rate</p>
            <p className="text-2xl font-mono font-bold text-white">
              {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00d4ff]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">Active Machines</p>
            <p className="text-2xl font-mono font-bold text-[#00d4ff]">
              {machines.filter(m => m.status === 'active').length}
            </p>
          </div>
        </div>

        {/* Error display */}
        {machinesError && (
          <div className="mb-4 p-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
            <p className="text-[#ff4444] text-sm">{machinesError}</p>
            <button
              onClick={clearError}
              className="text-[#ff4444] text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Machines Section */}
        <div className="mb-6">
          <h3 className="text-lg lg:text-xl font-semibold mb-4 text-[#00d4ff] flex items-center gap-2">
            <span>🎰</span>
            Your Machines
          </h3>
          <MachineGrid
            machines={machines}
            incomes={incomes}
            onCollect={handleCollect}
            isCollecting={isCollecting}
            isLoading={isLoadingMachines}
          />
        </div>
      </div>
    </main>
  );
}
