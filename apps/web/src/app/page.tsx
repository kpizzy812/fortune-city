'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';
import { useMachinesStore } from '@/stores/machines.store';
import { useFortuneRateStore } from '@/stores/fortune-rate.store';
import { useTelegramWebApp } from '@/providers/TelegramProvider';
import { TelegramLoginButton } from '@/components/auth/TelegramLoginButton';
import { EmailLoginForm } from '@/components/auth/EmailLoginForm';
import { SolanaLoginButton } from '@/components/auth/SolanaLoginButton';
import { MachineGrid } from '@/components/machines/MachineGrid';
import { RiskyCollectModal } from '@/components/machines/RiskyCollectModal';
import { GambleResultAnimation } from '@/components/machines/GambleResultAnimation';
import { AutoCollectModal } from '@/components/machines/AutoCollectModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { useInterval } from '@/hooks/useInterval';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import type { GambleInfo, AutoCollectInfo } from '@/types';

const TELEGRAM_BOT_NAME = process.env.NEXT_PUBLIC_TELEGRAM_BOT_NAME || 'FortuneCityBot';

// Refresh server data every 30 seconds
const SERVER_REFRESH_INTERVAL = 30000;
// Interpolate income every second
const INCOME_INTERPOLATION_INTERVAL = 1000;

export default function Home() {
  const { user, token, isLoading: authLoading, error: authError, clearAuth, refreshUser, devLogin } = useAuthStore();
  const { isTelegramApp } = useTelegramWebApp();
  const { usdToFortune, fetchRate, isRateAvailable } = useFortuneRateStore();

  const t = useTranslations();
  const tCommon = useTranslations('common');
  const tAuth = useTranslations('auth');
  const tBrand = useTranslations('brand');
  const tDashboard = useTranslations('dashboard');

  const {
    machines,
    incomes,
    isLoadingMachines,
    isCollecting,
    lastGambleResult,
    gambleInfos,
    autoCollectInfos,
    error: machinesError,
    fetchMachines,
    fetchAllIncomes,
    collectCoins,
    riskyCollect,
    fetchGambleInfo,
    purchaseAutoCollect,
    fetchAutoCollectInfo,
    interpolateAllIncomes,
    clearError,
    clearLastGambleResult,
  } = useMachinesStore();

  // Modal states
  const [isRiskyModalOpen, setIsRiskyModalOpen] = useState(false);
  const [isResultModalOpen, setIsResultModalOpen] = useState(false);
  const [isAutoCollectModalOpen, setIsAutoCollectModalOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [currentGambleInfo, setCurrentGambleInfo] = useState<GambleInfo | null>(null);
  const [currentAutoCollectInfo, setCurrentAutoCollectInfo] = useState<AutoCollectInfo | null>(null);
  const [isPurchasingAutoCollect, setIsPurchasingAutoCollect] = useState(false);

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

  // Fetch fortune rate on mount and periodically
  useEffect(() => {
    fetchRate();
  }, [fetchRate]);

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
      fetchRate();
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

  // Handle risky collect (open modal)
  const handleRiskyCollect = useCallback(
    async (machineId: string) => {
      if (!token) return;
      setSelectedMachineId(machineId);

      // Fetch gamble info
      await fetchGambleInfo(token, machineId);
      setCurrentGambleInfo(gambleInfos[machineId] || null);

      setIsRiskyModalOpen(true);
    },
    [token, fetchGambleInfo, gambleInfos]
  );

  // Confirm risky collect
  const handleConfirmRiskyCollect = useCallback(
    async () => {
      if (!token || !selectedMachineId) return;

      try {
        await riskyCollect(token, selectedMachineId);
        // Close modal and show result
        setIsRiskyModalOpen(false);
        setIsResultModalOpen(true);
        // Refresh user balance
        refreshUser();
      } catch {
        // Error is handled in store
        setIsRiskyModalOpen(false);
      }
    },
    [token, selectedMachineId, riskyCollect, refreshUser]
  );

  // Close result modal
  const handleCloseResultModal = useCallback(() => {
    setIsResultModalOpen(false);
    clearLastGambleResult();
    setSelectedMachineId(null);
  }, [clearLastGambleResult]);

  // Handle Auto Collect (open modal)
  const handleAutoCollectClick = useCallback(
    async (machineId: string) => {
      if (!token) return;
      setSelectedMachineId(machineId);

      // Fetch auto collect info and use returned value
      const info = await fetchAutoCollectInfo(token, machineId);
      setCurrentAutoCollectInfo(info);

      setIsAutoCollectModalOpen(true);
    },
    [token, fetchAutoCollectInfo]
  );

  // Confirm Auto Collect purchase
  const handleConfirmAutoCollect = useCallback(
    async () => {
      if (!token || !selectedMachineId) return;

      setIsPurchasingAutoCollect(true);
      try {
        await purchaseAutoCollect(token, selectedMachineId);
        // Refresh user balance
        refreshUser();
        // Update auto collect info and use returned value
        const info = await fetchAutoCollectInfo(token, selectedMachineId);
        setCurrentAutoCollectInfo(info);
      } catch {
        // Error is handled in store
      } finally {
        setIsPurchasingAutoCollect(false);
      }
    },
    [token, selectedMachineId, purchaseAutoCollect, refreshUser, fetchAutoCollectInfo]
  );

  // Show loading state
  if (authLoading) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="animate-spin rounded-full h-16 w-16 border-4 border-[#00d4ff] border-t-transparent" />
        <p className="mt-4 text-[#b0b0b0]">{tCommon('loading')}</p>
      </main>
    );
  }

  // Show auth error
  if (authError) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-8">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-[#ff2d95] mb-4">{tAuth('authError')}</h1>
          <p className="text-[#b0b0b0] mb-6">{authError}</p>
          <button
            onClick={clearAuth}
            className="px-6 py-3 bg-[#ff2d95] text-white rounded-lg hover:bg-[#ff2d95]/80 transition"
          >
            {tCommon('tryAgain')}
          </button>
        </div>
      </main>
    );
  }

  // Show login page if not authenticated
  if (!user) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center p-6 lg:p-8">
        <div className="w-full max-w-md">
          {/* Logo */}
          <div className="text-center mb-10">
            <h1 className="text-5xl lg:text-6xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent mb-3">
              {tBrand('name')}
            </h1>
            <p className="text-[#ffd700] text-lg lg:text-xl italic">
              {tBrand('tagline')}
            </p>
          </div>

          {/* Description */}
          <p className="text-[#b0b0b0] text-center mb-10 leading-relaxed">
            {tBrand('description')}
          </p>

          {/* Auth Section */}
          {isTelegramApp ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent mx-auto mb-4" />
              <p className="text-[#00d4ff] text-lg">{tAuth('authenticating')}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Email Login Form */}
              <div className="bg-[#2a1a4e] rounded-xl p-6 border border-[#00d4ff]/30">
                <h2 className="text-white text-lg font-semibold mb-4 text-center">
                  {tAuth('signInWithEmail')}
                </h2>
                <EmailLoginForm
                  onSuccess={() => console.log('Email login success')}
                  onError={(err) => console.error('Email login error:', err)}
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#b0b0b0]/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#1a0a2e] text-[#b0b0b0]">
                    {tAuth('or')}
                  </span>
                </div>
              </div>

              {/* Solana Wallet Login */}
              <div className="bg-[#2a1a4e] rounded-xl p-6 border border-[#9945FF]/30">
                <h2 className="text-white text-lg font-semibold mb-4 text-center">
                  {tAuth('signInWithWallet')}
                </h2>
                <SolanaLoginButton
                  onSuccess={() => console.log('Solana login success')}
                  onError={(err) => console.error('Solana login error:', err)}
                />
              </div>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-[#b0b0b0]/20"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-[#1a0a2e] text-[#b0b0b0]">
                    {tAuth('or')}
                  </span>
                </div>
              </div>

              {/* Telegram Login */}
              <div className="bg-[#2a1a4e] rounded-xl p-6 border border-[#ff2d95]/30">
                <h2 className="text-white text-lg font-semibold mb-4 text-center">
                  {tAuth('signInWithTelegram')}
                </h2>
                <div className="flex justify-center">
                  <TelegramLoginButton
                    botName={TELEGRAM_BOT_NAME}
                    onSuccess={() => console.log('Telegram login success')}
                    onError={(err) => console.error('Telegram login error:', err)}
                  />
                </div>
              </div>

              {/* Dev Login - only in development */}
              {process.env.NODE_ENV === 'development' && (
                <button
                  onClick={devLogin}
                  className="w-full px-6 py-2 bg-[#2a1a4e] border border-[#ff2d95]/50 text-[#ff2d95] rounded-lg hover:bg-[#ff2d95]/10 transition text-sm"
                >
                  {tAuth('devLogin')}
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
      <div className="max-w-4xl mx-auto">
        {/* Header - visible only on mobile (on desktop it's in sidebar) */}
        <header className="flex items-center justify-between mb-6 lg:hidden">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
            {tBrand('name')}
          </h1>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-[#b0b0b0]">{tBrand('currency')}</p>
              <p className="text-lg text-[#ffd700] font-mono font-bold">
                ${parseFloat(user.fortuneBalance).toFixed(2)}
              </p>
              {isRateAvailable() && (
                <p className="text-[10px] text-[#b0b0b0]">
                  ({Math.floor(usdToFortune(parseFloat(user.fortuneBalance)) ?? 0).toLocaleString()} $FORTUNE)
                </p>
              )}
            </div>
            <LanguageSwitcher />
            <button
              onClick={clearAuth}
              className="p-2 text-[#b0b0b0] hover:text-white transition"
              title={t('nav.logout')}
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
        <div className="hidden lg:block mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-[#00d4ff]">{tDashboard('title')}</h2>
          <p className="text-sm text-[#b0b0b0]">{tDashboard('subtitle')}</p>
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
              <p className="text-xs text-[#b0b0b0]">{tDashboard('machines')}</p>
              <p className="text-lg font-mono text-white">{machines.length}</p>
            </div>
            <div className="bg-[#1a0a2e] rounded-lg p-3 text-center">
              <p className="text-xs text-[#b0b0b0]">{tDashboard('maxTier')}</p>
              <p className="text-lg font-mono text-[#ff2d95]">
                {user.maxTierReached || '-'}
              </p>
            </div>
            <div className="bg-[#1a0a2e] rounded-lg p-3 text-center">
              <Tooltip content={tDashboard('taxTooltip')} position="top">
                <p className="text-xs text-[#b0b0b0]">{tDashboard('tax')}</p>
              </Tooltip>
              <p className="text-lg font-mono text-white">
                {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
              </p>
            </div>
          </div>
        </div>

        {/* Desktop Stats Bar */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-4 mb-8">
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">{tDashboard('totalMachines')}</p>
            <p className="text-2xl font-mono font-bold text-white">{machines.length}</p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">{tDashboard('maxTierReached')}</p>
            <p className="text-2xl font-mono font-bold text-[#ff2d95]">{user.maxTierReached || '-'}</p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <Tooltip content={tDashboard('taxTooltip')} position="bottom">
              <p className="text-sm text-[#b0b0b0] mb-1">{tDashboard('currentTaxRate')}</p>
            </Tooltip>
            <p className="text-2xl font-mono font-bold text-white">
              {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00d4ff]/30">
            <p className="text-sm text-[#b0b0b0] mb-1">{tDashboard('activeMachines')}</p>
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
              {tCommon('dismiss')}
            </button>
          </div>
        )}

        {/* Machines Section */}
        <div className="mb-6">
          <h3 className="text-lg lg:text-xl font-semibold mb-4 text-[#00d4ff] flex items-center gap-2">
            <span>🎰</span>
            {tDashboard('yourMachines')}
          </h3>
          <MachineGrid
            machines={machines}
            incomes={incomes}
            onCollect={handleCollect}
            onRiskyCollect={handleRiskyCollect}
            onAutoCollectClick={handleAutoCollectClick}
            isCollecting={isCollecting}
            isLoading={isLoadingMachines}
          />
        </div>

        {/* Modals */}
        {selectedMachineId && (
          <>
            <RiskyCollectModal
              isOpen={isRiskyModalOpen}
              onClose={() => setIsRiskyModalOpen(false)}
              onConfirm={handleConfirmRiskyCollect}
              amount={incomes[selectedMachineId]?.accumulated || 0}
              gambleInfo={currentGambleInfo}
              isLoading={isCollecting[selectedMachineId] || false}
            />
            <GambleResultAnimation
              isOpen={isResultModalOpen}
              onClose={handleCloseResultModal}
              result={lastGambleResult}
            />
            <AutoCollectModal
              isOpen={isAutoCollectModalOpen}
              onClose={() => setIsAutoCollectModalOpen(false)}
              onConfirm={handleConfirmAutoCollect}
              autoCollectInfo={currentAutoCollectInfo}
              userBalance={parseFloat(user?.fortuneBalance || '0')}
              isLoading={isPurchasingAutoCollect}
            />
          </>
        )}
      </div>
    </main>
  );
}
