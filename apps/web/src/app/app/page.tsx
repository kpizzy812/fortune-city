'use client';

import { useEffect, useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';
import { useMachinesStore } from '@/stores/machines.store';
import { useFortuneRateStore } from '@/stores/fortune-rate.store';
import { Gamepad2, Trophy, Percent, Zap, X } from 'lucide-react';
import { CasinoFloor } from '@/components/machines/CasinoFloor';
import { MachineCard } from '@/components/machines/MachineCard';
import { RiskyCollectModal } from '@/components/machines/RiskyCollectModal';
import { GambleResultAnimation } from '@/components/machines/GambleResultAnimation';
import { AutoCollectModal } from '@/components/machines/AutoCollectModal';
import { Tooltip } from '@/components/ui/Tooltip';
import { useInterval } from '@/hooks/useInterval';
import { MusicToggleButton } from '@/components/layout/MusicToggleButton';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { TelegramConnectionBanner } from '@/components/notifications/TelegramConnectionBanner';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { ActivityFeed } from '@/components/activity/ActivityFeed';
import { DailyLoginBanner } from '@/components/fame/DailyLoginBanner';
import { FameBadge } from '@/components/fame/FameBadge';
import { getUserInitial } from '@/lib/utils';
import { useFeedback } from '@/hooks/useFeedback';
import type { GambleInfo, AutoCollectInfo, PaymentMethod } from '@/types';

// City fee tiers (mirrors backend taxRatesByTier)
const CITY_FEE_TIERS: Record<number, number> = {1:50,2:50,3:40,4:40,5:30,6:30,7:20,8:20,9:20,10:10};
function getNextFeeTier(currentMax: number): number {
  return [3, 5, 7, 10].find(t => t > currentMax) || 10;
}
function getNextFeeRate(currentMax: number): number {
  return CITY_FEE_TIERS[getNextFeeTier(currentMax)] ?? 10;
}

// Refresh server data every 30 seconds
const SERVER_REFRESH_INTERVAL = 30000;
// Interpolate income every second
const INCOME_INTERPOLATION_INTERVAL = 1000;

export default function DashboardPage() {
  const { user, token, refreshUser } = useAuthStore();
  const { fetchRate } = useFortuneRateStore();
  const { collect: fbCollect, win: fbWin, lose: fbLose, purchase: fbPurchase, click: fbClick } = useFeedback();

  const tCommon = useTranslations('common');
  const tDashboard = useTranslations('dashboard');
  const tProfile = useTranslations('profile');

  const {
    machines,
    incomes,
    isLoadingMachines,
    isCollecting,
    lastGambleResult,
    gambleInfos,
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
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [selectedMachineId, setSelectedMachineId] = useState<string | null>(null);
  const [currentGambleInfo, setCurrentGambleInfo] = useState<GambleInfo | null>(null);
  const [currentAutoCollectInfo, setCurrentAutoCollectInfo] = useState<AutoCollectInfo | null>(null);
  const [isPurchasingAutoCollect, setIsPurchasingAutoCollect] = useState(false);
  const [floorSelectedMachineId, setFloorSelectedMachineId] = useState<string | null>(null);

  const userInitial = user ? getUserInitial(user) : '?';

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
  }, INCOME_INTERPOLATION_INTERVAL);

  // Server sync every 30 seconds
  useInterval(() => {
    if (token && machines.length > 0) {
      fetchAllIncomes(token);
      refreshUser();
      fetchRate();
    }
  }, SERVER_REFRESH_INTERVAL);

  // Handle collect
  const handleCollect = useCallback(
    async (machineId: string) => {
      if (!token) return;
      try {
        await collectCoins(token, machineId);
        fbCollect();
        refreshUser();
      } catch {
        // Error is handled in store
      }
    },
    [token, collectCoins, refreshUser, fbCollect]
  );

  // Handle risky collect (open modal)
  const handleRiskyCollect = useCallback(
    async (machineId: string) => {
      if (!token) return;
      setSelectedMachineId(machineId);
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
      fbClick();
      try {
        const result = await riskyCollect(token, selectedMachineId);
        setIsRiskyModalOpen(false);
        setIsResultModalOpen(true);
        if (result?.won) {
          fbWin();
        } else {
          fbLose();
        }
        refreshUser();
      } catch {
        fbLose();
        setIsRiskyModalOpen(false);
      }
    },
    [token, selectedMachineId, riskyCollect, refreshUser, fbClick, fbWin, fbLose]
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
      const info = await fetchAutoCollectInfo(token, machineId);
      setCurrentAutoCollectInfo(info);
      setIsAutoCollectModalOpen(true);
    },
    [token, fetchAutoCollectInfo]
  );

  // Confirm Auto Collect purchase
  const handleConfirmAutoCollect = useCallback(
    async (paymentMethod: PaymentMethod) => {
      if (!token || !selectedMachineId) return;
      setIsPurchasingAutoCollect(true);
      try {
        await purchaseAutoCollect(token, selectedMachineId, paymentMethod);
        fbPurchase();
        refreshUser();
        const info = await fetchAutoCollectInfo(token, selectedMachineId);
        setCurrentAutoCollectInfo(info);
      } catch {
        // Error is handled in store
      } finally {
        setIsPurchasingAutoCollect(false);
      }
    },
    [token, selectedMachineId, purchaseAutoCollect, refreshUser, fetchAutoCollectInfo, fbPurchase]
  );

  // user is guaranteed by layout guard
  if (!user) return null;

  return (
    <main className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header - visible only on mobile */}
        <header className="flex items-center justify-end mb-3 lg:hidden">
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-lg lg:text-xl text-[#ffd700] font-mono font-bold">
                ${parseFloat(user.fortuneBalance).toFixed(2)}
              </p>
              <FameBadge size="sm" />
            </div>
            <MusicToggleButton />
            <NotificationBell />
            <LanguageSwitcher />
            <button
              onClick={() => setIsProfileOpen(true)}
              className="w-9 h-9 rounded-full bg-gradient-to-br from-[#ff2d95] to-[#00d4ff] flex items-center justify-center text-sm font-bold hover:shadow-[0_0_15px_rgba(255,45,149,0.5)] transition-shadow"
              title={tProfile('title')}
            >
              {userInitial}
            </button>
          </div>
        </header>

        {/* Desktop page title */}
        <div className="hidden lg:block mb-6">
          <h2 className="text-2xl lg:text-3xl font-bold text-[#00d4ff]">{tDashboard('title')}</h2>
          <p className="text-sm text-[#b0b0b0]">{tDashboard('subtitle')}</p>
        </div>

        <TelegramConnectionBanner />
        <DailyLoginBanner />

        {/* User Stats Card - mobile */}
        <div className="grid grid-cols-3 gap-2 mb-4 lg:hidden">
          <div className="relative bg-[#1a0a2e]/80 backdrop-blur-lg rounded-xl p-2.5 text-center border border-[#ff2d95]/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff2d95]/5 to-transparent" />
            <div className="relative">
              <Gamepad2 className="w-4 h-4 text-[#ff2d95] mx-auto mb-0.5" />
              <p className="text-[10px] text-[#b0b0b0]">{tDashboard('machines')}</p>
              <p className="text-base font-mono font-bold text-white">{machines.length}</p>
            </div>
          </div>
          <div className="relative bg-[#1a0a2e]/80 backdrop-blur-lg rounded-xl p-2.5 text-center border border-[#ffd700]/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ffd700]/5 to-transparent" />
            <div className="relative">
              <Trophy className="w-4 h-4 text-[#ffd700] mx-auto mb-0.5" />
              <p className="text-[10px] text-[#b0b0b0]">{tDashboard('maxTier')}</p>
              <p className="text-base font-mono font-bold text-[#ffd700]">
                {user.maxTierReached || '-'}
              </p>
            </div>
          </div>
          <div className="relative bg-[#1a0a2e]/80 backdrop-blur-lg rounded-xl p-2.5 text-center border border-[#a855f7]/20 overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/5 to-transparent" />
            <div className="relative">
              <Percent className="w-4 h-4 text-[#a855f7] mx-auto mb-0.5" />
              <Tooltip content={tDashboard('cityFeeTooltip')} position="top" showIcon={false}>
                <p className="text-[10px] text-[#b0b0b0] underline decoration-dotted cursor-help">{tDashboard('cityFee')}</p>
              </Tooltip>
              <p className="text-base font-mono font-bold text-white">
                {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
              </p>
              {user.maxTierReached < 10 && (
                <p className="text-[9px] text-[#a855f7]/70 mt-0.5">
                  {tDashboard('cityFeeProgress', { target: getNextFeeRate(user.maxTierReached), targetTier: getNextFeeTier(user.maxTierReached) })}
                </p>
              )}
              {user.maxTierReached >= 10 && (
                <p className="text-[9px] text-[#22c55e]/70 mt-0.5">{tDashboard('cityFeeMin')}</p>
              )}
            </div>
          </div>
        </div>

        {/* Desktop Stats Bar */}
        <div className="hidden lg:grid lg:grid-cols-4 gap-4 mb-8">
          <div className="group relative bg-[#1a0a2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-[#ff2d95]/20 hover:border-[#ff2d95]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,45,149,0.15)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ff2d95]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm text-[#b0b0b0] mb-2">{tDashboard('totalMachines')}</p>
                <p className="text-3xl font-mono font-bold text-white tracking-tight">{machines.length}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ff2d95]/20 to-[#ff2d95]/5 flex items-center justify-center border border-[#ff2d95]/20 group-hover:shadow-[0_0_20px_rgba(255,45,149,0.3)] transition-shadow duration-300">
                <Gamepad2 className="w-6 h-6 text-[#ff2d95]" />
              </div>
            </div>
          </div>

          <div className="group relative bg-[#1a0a2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-[#ffd700]/20 hover:border-[#ffd700]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(255,215,0,0.15)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#ffd700]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm text-[#b0b0b0] mb-2">{tDashboard('maxTierReached')}</p>
                <p className="text-3xl font-mono font-bold text-[#ffd700] tracking-tight">{user.maxTierReached || '-'}</p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#ffd700]/20 to-[#ffd700]/5 flex items-center justify-center border border-[#ffd700]/20 group-hover:shadow-[0_0_20px_rgba(255,215,0,0.3)] transition-shadow duration-300">
                <Trophy className="w-6 h-6 text-[#ffd700]" />
              </div>
            </div>
          </div>

          <div className="group relative bg-[#1a0a2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-[#a855f7]/20 hover:border-[#a855f7]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(168,85,247,0.15)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#a855f7]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start justify-between">
              <div>
                <div className="mb-2">
                  <Tooltip content={tDashboard('cityFeeTooltip')} position="bottom">
                    <span className="text-sm text-[#b0b0b0]">{tDashboard('currentCityFee')}</span>
                  </Tooltip>
                </div>
                <p className="text-3xl font-mono font-bold text-white tracking-tight">
                  {(parseFloat(user.currentTaxRate) * 100).toFixed(0)}%
                </p>
                {user.maxTierReached < 10 ? (
                  <p className="text-xs text-[#a855f7]/70 mt-1">
                    {tDashboard('cityFeeProgress', { target: getNextFeeRate(user.maxTierReached), targetTier: getNextFeeTier(user.maxTierReached) })}
                  </p>
                ) : (
                  <p className="text-xs text-[#22c55e]/70 mt-1">{tDashboard('cityFeeMin')}</p>
                )}
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#a855f7]/20 to-[#a855f7]/5 flex items-center justify-center border border-[#a855f7]/20 group-hover:shadow-[0_0_20px_rgba(168,85,247,0.3)] transition-shadow duration-300">
                <Percent className="w-6 h-6 text-[#a855f7]" />
              </div>
            </div>
          </div>

          <div className="group relative bg-[#1a0a2e]/60 backdrop-blur-xl rounded-2xl p-5 border border-[#00d4ff]/20 hover:border-[#00d4ff]/50 transition-all duration-300 hover:shadow-[0_0_30px_rgba(0,212,255,0.15)] overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-[#00d4ff]/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative flex items-start justify-between">
              <div>
                <p className="text-sm text-[#b0b0b0] mb-2">{tDashboard('activeMachines')}</p>
                <p className="text-3xl font-mono font-bold text-[#00d4ff] tracking-tight">
                  {machines.filter(m => m.status === 'active').length}
                </p>
              </div>
              <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#00d4ff]/20 to-[#00d4ff]/5 flex items-center justify-center border border-[#00d4ff]/20 group-hover:shadow-[0_0_20px_rgba(0,212,255,0.3)] transition-shadow duration-300">
                <Zap className="w-6 h-6 text-[#00d4ff]" />
              </div>
            </div>
          </div>
        </div>

        {/* Error display */}
        {machinesError && (
          <div className="mb-4 p-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
            <p className="text-[#ff4444] text-sm">{machinesError}</p>
            <button onClick={clearError} className="text-[#ff4444] text-xs underline mt-1">
              {tCommon('dismiss')}
            </button>
          </div>
        )}

        <ActivityFeed />

        {/* Casino Floor */}
        <div className="mb-6 -mx-4 lg:mx-0">
          <CasinoFloor
            machines={machines}
            incomes={incomes}
            onCollect={handleCollect}
            onRiskyCollect={handleRiskyCollect}
            onAutoCollectClick={handleAutoCollectClick}
            onMachineClick={setFloorSelectedMachineId}
            isCollecting={isCollecting}
            isLoading={isLoadingMachines}
          />
        </div>

        {/* Machine Detail Modal */}
        {floorSelectedMachineId && (() => {
          const detailMachine = machines.find(m => m.id === floorSelectedMachineId);
          if (!detailMachine) return null;
          return (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
              onClick={() => setFloorSelectedMachineId(null)}
            >
              <div className="relative w-full max-w-sm" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setFloorSelectedMachineId(null)}
                  className="absolute -top-3 -right-3 z-10 w-8 h-8 bg-[#2a1a4e] border border-[#ff2d95]/30 rounded-full flex items-center justify-center text-white/70 hover:text-white transition"
                >
                  <X className="w-4 h-4" />
                </button>
                <MachineCard
                  machine={detailMachine}
                  income={incomes[detailMachine.id] || null}
                  onCollect={() => handleCollect(detailMachine.id)}
                  onRiskyCollect={() => handleRiskyCollect(detailMachine.id)}
                  onAutoCollectClick={() => handleAutoCollectClick(detailMachine.id)}
                  isCollecting={isCollecting[detailMachine.id] || false}
                />
              </div>
            </div>
          );
        })()}

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
              userFame={user?.fame ?? 0}
              isLoading={isPurchasingAutoCollect}
            />
          </>
        )}

        <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
      </div>
    </main>
  );
}
