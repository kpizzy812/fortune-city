'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useMachinesStore } from '@/stores/machines.store';
import { TierGrid } from '@/components/shop/TierGrid';
import { PurchaseModal } from '@/components/shop/PurchaseModal';
import type { TierInfo } from '@/types';

export default function ShopPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuthStore();
  const {
    tiers,
    affordability,
    isLoadingTiers,
    isPurchasing,
    error,
    fetchTiers,
    checkAllAffordability,
    purchaseMachine,
    clearError,
  } = useMachinesStore();

  // Modal state
  const [selectedTier, setSelectedTier] = useState<TierInfo | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user || !token) {
      router.push('/');
    }
  }, [user, token, router]);

  // Load tiers
  useEffect(() => {
    fetchTiers();
  }, [fetchTiers]);

  // Check affordability when tiers or user changes
  useEffect(() => {
    if (token && user && tiers.length > 0) {
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
    <main className="min-h-screen p-4">
      {/* Header */}
      <header className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#00d4ff]">Machine Shop</h1>
          <p className="text-sm text-[#b0b0b0]">Buy new slot machines</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#b0b0b0]">Balance</p>
          <p className="text-lg text-[#ffd700] font-mono font-bold">
            ${userBalance.toFixed(2)}
          </p>
        </div>
      </header>

      {/* Info card */}
      <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00d4ff]/30 mb-6">
        <div className="flex items-start gap-3">
          <span className="text-2xl">💡</span>
          <div className="text-sm text-[#b0b0b0]">
            <p className="mb-1">
              <span className="text-white font-medium">Unlock new tiers</span> by purchasing
              machines one level at a time.
            </p>
            <p>
              Current max tier: <span className="text-[#ff2d95] font-mono">{user.maxTierReached || 0}</span>
              {' '}&rarr;{' '}
              Next unlock: <span className="text-[#00ff88] font-mono">Tier {(user.maxTierReached || 0) + 1}</span>
            </p>
          </div>
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="mb-4 p-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
          <p className="text-[#ff4444] text-sm">{error}</p>
          <button
            onClick={clearError}
            className="text-[#ff4444] text-xs underline mt-1"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Tier Grid */}
      <TierGrid
        tiers={tiers}
        affordability={affordability}
        maxTierReached={user.maxTierReached}
        onBuyTier={handleBuyTier}
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
    </main>
  );
}
