import { create } from 'zustand';
import { api, ReferralStats, ReferralListItem } from '@/lib/api';

interface ReferralsState {
  stats: ReferralStats | null;
  referrals: ReferralListItem[];
  canWithdraw: boolean;
  isLoading: boolean;
  isWithdrawing: boolean;
  error: string | null;

  fetchStats: (token: string) => Promise<void>;
  fetchReferrals: (token: string) => Promise<void>;
  checkCanWithdraw: (token: string) => Promise<void>;
  withdrawBalance: (token: string, amount?: number) => Promise<void>;
  clearError: () => void;
}

export const useReferralsStore = create<ReferralsState>((set) => ({
  stats: null,
  referrals: [],
  canWithdraw: false,
  isLoading: false,
  isWithdrawing: false,
  error: null,

  fetchStats: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const stats = await api.getReferralStats(token);
      set({ stats, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch stats',
        isLoading: false,
      });
    }
  },

  fetchReferrals: async (token: string) => {
    set({ isLoading: true, error: null });
    try {
      const referrals = await api.getReferralList(token);
      set({ referrals, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to fetch referrals',
        isLoading: false,
      });
    }
  },

  checkCanWithdraw: async (token: string) => {
    try {
      const result = await api.canWithdrawReferralBalance(token);
      set({ canWithdraw: result.canWithdraw });
    } catch {
      set({ canWithdraw: false });
    }
  },

  withdrawBalance: async (token: string, amount?: number) => {
    set({ isWithdrawing: true, error: null });
    try {
      await api.withdrawReferralBalance(token, amount);
      // Refresh stats after withdrawal
      const stats = await api.getReferralStats(token);
      set({
        stats,
        isWithdrawing: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to withdraw',
        isWithdrawing: false,
      });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
