'use client';

import { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import dynamic from 'next/dynamic';
import { useAuthStore } from '@/stores/auth.store';
import { useMachinesStore } from '@/stores/machines.store';
import { useFortuneRateStore } from '@/stores/fortune-rate.store';
import { TierCarousel } from '@/components/shop/TierCarousel';
import { PurchaseModal } from '@/components/shop/PurchaseModal';
import { SellMachineModal } from '@/components/shop/SellMachineModal';
import { TopUpAndBuyModal } from '@/components/shop/TopUpAndBuyModal';
import { usePurchaseIntentStore } from '@/stores/purchase-intent.store';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';
import { api } from '@/lib/api';
import type { TierInfo, Machine, SaleOptions } from '@/types';

// Dynamic import SolanaWalletProvider to avoid SSR issues
const SolanaWalletProvider = dynamic(
  () => import('@/providers/SolanaWalletProvider').then((mod) => mod.SolanaWalletProvider),
  { ssr: false }
);

export default function ShopPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuthStore();
  const { usdToFortune, isRateAvailable } = useFortuneRateStore();
  const t = useTranslations('shop');
  const tCommon = useTranslations('common');

  const {
    tiers,
    machines,
    affordability,
    isLoadingTiers,
    isPurchasing,
    error,
    fetchTiers,
    fetchMachines,
    checkAllAffordability,
    purchaseMachine,
    clearError,
  } = useMachinesStore();

  // Purchase modal state
  const [selectedTier, setSelectedTier] = useState<TierInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Sell modal state
  const [selectedMachineForSale, setSelectedMachineForSale] = useState<Machine | null>(null);
  const [isSellModalOpen, setIsSellModalOpen] = useState(false);
  const [saleOptions, setSaleOptions] = useState<SaleOptions | null>(null);
  const [isLoadingSaleOptions, setIsLoadingSaleOptions] = useState(false);

  // Top up and buy state
  const {
    pendingTierInfo,
    shortfallAmount,
    isTopUpModalOpen,
    setPendingPurchase,
    clearPendingPurchase,
  } = usePurchaseIntentStore();

  // Track if initial fetch was done
  const hasFetchedTiers = useRef(false);
  const hasFetchedMachines = useRef(false);
  const hasCheckedAffordability = useRef(false);

  // Create machinesByTier map from active machines
  const machinesByTier = useMemo(() => {
    const map: Record<number, Machine> = {};
    machines
      .filter(m => m.status === 'active' || m.status === 'listed_auction')
      .forEach(m => {
        map[m.tier] = m;
      });
    return map;
  }, [machines]);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user || !token) {
      router.push('/');
    }
  }, [user, token, router]);

  // Load tiers (only once)
  useEffect(() => {
    if (!hasFetchedTiers.current) {
      hasFetchedTiers.current = true;
      fetchTiers();
    }
  }, [fetchTiers]);

  // Load machines (only once)
  useEffect(() => {
    if (token && !hasFetchedMachines.current) {
      hasFetchedMachines.current = true;
      fetchMachines(token);
    }
  }, [token, fetchMachines]);

  // Check affordability when tiers load (only once per session)
  useEffect(() => {
    if (token && user && tiers.length > 0 && !hasCheckedAffordability.current) {
      hasCheckedAffordability.current = true;
      checkAllAffordability(token, user.maxTierReached);
    }
  }, [token, user, tiers.length, checkAllAffordability]);

  // Handle buy click
  const handleBuyTier = useCallback((tier: number) => {
    const tierInfo = tiers.find((t) => t.tier === tier);
    if (tierInfo) {
      setSelectedTier(tierInfo);
      setIsModalOpen(true);
    }
  }, [tiers]);

  // Handle purchase confirmation
  const handleConfirmPurchase = useCallback(async () => {
    if (!token || !selectedTier) return;

    try {
      await purchaseMachine(token, selectedTier.tier);
      // Refresh user to update balance
      await refreshUser();
      // Recheck affordability
      if (user) {
        checkAllAffordability(token, user.maxTierReached);
      }
      // Close modal
      setIsModalOpen(false);
      setSelectedTier(null);
      // Redirect to dashboard
      router.push('/');
    } catch {
      // Error is displayed in modal
    }
  }, [token, selectedTier, purchaseMachine, refreshUser, user, checkAllAffordability, router]);

  // Handle modal close
  const handleCloseModal = useCallback(() => {
    if (!isPurchasing) {
      setIsModalOpen(false);
      setSelectedTier(null);
      clearError();
    }
  }, [isPurchasing, clearError]);

  // Handle sell machine click
  const handleSellMachine = useCallback(async (machine: Machine) => {
    if (!token) return;

    setSelectedMachineForSale(machine);
    setIsSellModalOpen(true);
    setIsLoadingSaleOptions(true);

    try {
      const options = await api.getSaleOptions(token, machine.id);
      setSaleOptions(options);
    } catch (e) {
      console.error('Failed to load sale options:', e);
    } finally {
      setIsLoadingSaleOptions(false);
    }
  }, [token]);

  // Handle sell modal close
  const handleCloseSellModal = useCallback(() => {
    setIsSellModalOpen(false);
    setSelectedMachineForSale(null);
    setSaleOptions(null);
  }, []);

  // Handle auction listing
  const handleSellAuction = useCallback(async () => {
    if (!token || !selectedMachineForSale) return;

    await api.listOnAuction(token, selectedMachineForSale.id);
    // Refresh machines and affordability
    await fetchMachines(token);
    if (user) {
      checkAllAffordability(token, user.maxTierReached);
    }
  }, [token, selectedMachineForSale, fetchMachines, user, checkAllAffordability]);

  // Handle pawnshop sale
  const handleSellPawnshop = useCallback(async () => {
    if (!token || !selectedMachineForSale) return;

    await api.sellToPawnshop(token, selectedMachineForSale.id);
    // Refresh user balance, machines and affordability
    await refreshUser();
    await fetchMachines(token);
    if (user) {
      checkAllAffordability(token, user.maxTierReached);
    }
  }, [token, selectedMachineForSale, refreshUser, fetchMachines, user, checkAllAffordability]);

  // Handle top up and buy click
  const handleTopUpAndBuy = useCallback((tier: TierInfo, shortfall: number) => {
    setPendingPurchase(tier.tier, tier, shortfall);
  }, [setPendingPurchase]);

  // Handle successful top up - auto purchase
  const handleTopUpSuccess = useCallback(async () => {
    if (!token || !pendingTierInfo) return;

    // Purchase the machine
    await purchaseMachine(token, pendingTierInfo.tier);
    // Refresh user balance
    await refreshUser();
    // Recheck affordability
    if (user) {
      checkAllAffordability(token, user.maxTierReached);
    }
    // Clear the intent
    clearPendingPurchase();
    // Redirect to dashboard
    router.push('/');
  }, [token, pendingTierInfo, purchaseMachine, refreshUser, user, checkAllAffordability, clearPendingPurchase, router]);

  // Loading state
  if (!user || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
      </main>
    );
  }

  const userBalance = parseFloat(user.fortuneBalance);

  return (
    <main className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Mobile Header */}
        <header className="flex items-center justify-between mb-6 lg:hidden">
          <div>
            <h1 className="text-2xl font-bold text-[#00d4ff]">{t('title')}</h1>
            <p className="text-sm text-[#b0b0b0]">{t('subtitle')}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <p className="text-xs text-[#b0b0b0]">{tCommon('balance')}</p>
              <p className="text-lg text-[#ffd700] font-mono font-bold">
                ${userBalance.toFixed(2)}
              </p>
              {isRateAvailable() && (
                <p className="text-[10px] text-[#b0b0b0]">
                  ({Math.floor(usdToFortune(userBalance) ?? 0).toLocaleString()} $FORTUNE)
                </p>
              )}
            </div>
            <LanguageSwitcher />
          </div>
        </header>

        {/* Desktop Header */}
        <header className="hidden lg:flex lg:items-center lg:justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#00d4ff]">{t('pageTitle')}</h1>
            <p className="text-sm text-[#b0b0b0]">{t('pageSubtitle')}</p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl px-6 py-3 border border-[#ffd700]/30">
            <p className="text-sm text-[#b0b0b0]">{tCommon('yourBalance')}</p>
            <p className="text-2xl text-[#ffd700] font-mono font-bold">
              ${userBalance.toFixed(2)}
            </p>
            {isRateAvailable() && (
              <p className="text-xs text-[#b0b0b0] mt-0.5">
                ({Math.floor(usdToFortune(userBalance) ?? 0).toLocaleString()} $FORTUNE)
              </p>
            )}
          </div>
        </header>

        {/* Info card */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#00d4ff]/30 mb-6 lg:mb-8">
          <div className="flex items-start gap-3 lg:gap-4">
            <span className="text-2xl lg:text-3xl">💡</span>
            <div className="text-sm lg:text-base text-[#b0b0b0]">
              <p className="mb-1">
                <span className="text-white font-medium">{t('unlockHint')}</span>
              </p>
              <p>
                {t('currentMaxTier')} <span className="text-[#ff2d95] font-mono font-bold">{user.maxTierReached || 0}</span>
                {' '}&rarr;{' '}
                {t('nextUnlock')} <span className="text-[#00ff88] font-mono font-bold">{t('tier')} {(user.maxTierReached || 0) + 1}</span>
              </p>
            </div>
          </div>
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-4 lg:mb-6 p-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
            <p className="text-[#ff4444] text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-[#ff4444] text-xs underline mt-1"
            >
              {tCommon('dismiss')}
            </button>
          </div>
        )}

        {/* Tier Carousel */}
        <TierCarousel
          tiers={tiers}
          affordability={affordability}
          machinesByTier={machinesByTier}
          maxTierReached={user.maxTierReached}
          onBuyTier={handleBuyTier}
          onSellMachine={handleSellMachine}
          onTopUpAndBuy={handleTopUpAndBuy}
          isPurchasing={isPurchasing}
          isLoading={isLoadingTiers}
        />

        {/* Purchase Modal */}
        <PurchaseModal
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          tier={selectedTier}
          canAfford={selectedTier ? affordability[selectedTier.tier] : null}
          onConfirm={handleConfirmPurchase}
          isLoading={isPurchasing}
          userBalance={userBalance}
        />

        {/* Sell Modal */}
        <SellMachineModal
          isOpen={isSellModalOpen}
          onClose={handleCloseSellModal}
          machine={selectedMachineForSale}
          saleOptions={saleOptions}
          isLoading={isLoadingSaleOptions}
          onSellAuction={handleSellAuction}
          onSellPawnshop={handleSellPawnshop}
        />

        {/* Top Up and Buy Modal - wrapped in SolanaWalletProvider for wallet access */}
        {isTopUpModalOpen && (
          <SolanaWalletProvider>
            <TopUpAndBuyModal
              isOpen={isTopUpModalOpen}
              onClose={clearPendingPurchase}
              tier={pendingTierInfo}
              shortfall={shortfallAmount ?? 0}
              onSuccess={handleTopUpSuccess}
            />
          </SolanaWalletProvider>
        )}
      </div>
    </main>
  );
}
