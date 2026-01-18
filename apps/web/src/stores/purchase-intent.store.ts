'use client';

import { create } from 'zustand';
import type { TierInfo } from '@/types';

interface PurchaseIntentState {
  // Pending purchase data
  pendingTier: number | null;
  pendingTierInfo: TierInfo | null;
  shortfallAmount: number | null;

  // UI state
  isTopUpModalOpen: boolean;

  // Actions
  setPendingPurchase: (tier: number, tierInfo: TierInfo, shortfall: number) => void;
  clearPendingPurchase: () => void;
  openTopUpModal: () => void;
  closeTopUpModal: () => void;
}

export const usePurchaseIntentStore = create<PurchaseIntentState>()((set) => ({
  // Initial state
  pendingTier: null,
  pendingTierInfo: null,
  shortfallAmount: null,
  isTopUpModalOpen: false,

  setPendingPurchase: (tier, tierInfo, shortfall) => {
    set({
      pendingTier: tier,
      pendingTierInfo: tierInfo,
      shortfallAmount: shortfall,
      isTopUpModalOpen: true,
    });
  },

  clearPendingPurchase: () => {
    set({
      pendingTier: null,
      pendingTierInfo: null,
      shortfallAmount: null,
      isTopUpModalOpen: false,
    });
  },

  openTopUpModal: () => {
    set({ isTopUpModalOpen: true });
  },

  closeTopUpModal: () => {
    set({ isTopUpModalOpen: false });
  },
}));
