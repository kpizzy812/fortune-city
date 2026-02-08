'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type {
  FameBalance,
  FameTransaction,
  DailyLoginResult,
} from '@/types';

interface FameState {
  // State
  balance: FameBalance | null;
  history: FameTransaction[];
  historyTotal: number;
  historyPage: number;
  lastDailyLogin: DailyLoginResult | null;

  // Loading states
  isLoadingBalance: boolean;
  isLoadingHistory: boolean;
  isClaiming: boolean;
  // Error
  error: string | null;

  // Actions
  fetchBalance: (token: string) => Promise<void>;
  fetchHistory: (token: string, page?: number) => Promise<void>;
  claimDailyLogin: (token: string) => Promise<DailyLoginResult>;

  // Helpers
  canClaimToday: () => boolean;
  clearError: () => void;
  clearLastDailyLogin: () => void;
  reset: () => void;
}

export const useFameStore = create<FameState>((set, get) => ({
  balance: null,
  history: [],
  historyTotal: 0,
  historyPage: 1,
  lastDailyLogin: null,
  isLoadingBalance: false,
  isLoadingHistory: false,
  isClaiming: false,
  error: null,

  fetchBalance: async (token) => {
    set({ isLoadingBalance: true, error: null });
    try {
      const balance = await api.getFameBalance(token);
      set({ balance, isLoadingBalance: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load fame balance';
      set({ error: message, isLoadingBalance: false });
    }
  },

  fetchHistory: async (token, page = 1) => {
    set({ isLoadingHistory: true, error: null });
    try {
      const result = await api.getFameHistory(token, page);
      set({
        history: result.items,
        historyTotal: result.total,
        historyPage: result.page,
        isLoadingHistory: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load fame history';
      set({ error: message, isLoadingHistory: false });
    }
  },

  claimDailyLogin: async (token) => {
    set({ isClaiming: true, error: null });
    try {
      const result = await api.claimDailyLogin(token);
      // Update local balance
      set((state) => ({
        balance: state.balance
          ? {
              ...state.balance,
              fame: result.totalFame,
              totalFameEarned: state.balance.totalFameEarned + result.earned,
              loginStreak: result.streak,
              lastLoginDate: new Date().toISOString(),
            }
          : null,
        lastDailyLogin: result,
        isClaiming: false,
      }));
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to claim daily login';
      set({ error: message, isClaiming: false });
      throw e;
    }
  },

  canClaimToday: () => {
    const { balance } = get();
    if (!balance?.lastLoginDate) return true;

    const lastLogin = new Date(balance.lastLoginDate);
    const now = new Date();
    // Compare UTC dates
    return (
      lastLogin.getUTCFullYear() !== now.getUTCFullYear() ||
      lastLogin.getUTCMonth() !== now.getUTCMonth() ||
      lastLogin.getUTCDate() !== now.getUTCDate()
    );
  },

  clearError: () => set({ error: null }),
  clearLastDailyLogin: () => set({ lastDailyLogin: null }),

  reset: () =>
    set({
      balance: null,
      history: [],
      historyTotal: 0,
      historyPage: 1,
      lastDailyLogin: null,
      isLoadingBalance: false,
      isLoadingHistory: false,
      isClaiming: false,
      error: null,
    }),
}));
