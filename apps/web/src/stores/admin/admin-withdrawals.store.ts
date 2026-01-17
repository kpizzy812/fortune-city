'use client';

import { create } from 'zustand';
import {
  api,
  AdminWithdrawalListItem,
  AdminWithdrawalDetail,
  AdminWithdrawalsStatsResponse,
  AdminWithdrawalsFilter,
  WithdrawalSortField,
  WithdrawalStatusFilter,
  SortOrder,
} from '@/lib/api';
import { useAdminAuthStore } from './admin-auth.store';

interface AdminWithdrawalsState {
  // Data
  withdrawals: AdminWithdrawalListItem[];
  selectedWithdrawal: AdminWithdrawalDetail | null;
  stats: AdminWithdrawalsStatsResponse | null;

  // Pagination
  total: number;
  limit: number;
  offset: number;

  // Filters
  filters: AdminWithdrawalsFilter;

  // UI State
  isLoading: boolean;
  isLoadingDetail: boolean;
  isProcessing: boolean;
  error: string | null;

  // Actions
  fetchWithdrawals: (resetOffset?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchWithdrawal: (id: string) => Promise<AdminWithdrawalDetail | null>;
  approveWithdrawal: (id: string, note?: string) => Promise<AdminWithdrawalDetail>;
  completeWithdrawal: (id: string, txSignature: string, note?: string) => Promise<AdminWithdrawalDetail>;
  rejectWithdrawal: (id: string, reason: string) => Promise<AdminWithdrawalDetail>;

  // Filter actions
  setSearch: (search: string) => void;
  setStatus: (status: WithdrawalStatusFilter) => void;
  setSortBy: (sortBy: WithdrawalSortField) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;

  // Utility
  clearError: () => void;
  clearSelectedWithdrawal: () => void;
}

const DEFAULT_FILTERS: AdminWithdrawalsFilter = {
  limit: 20,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  status: 'all',
};

export const useAdminWithdrawalsStore = create<AdminWithdrawalsState>((set, get) => ({
  // Initial data
  withdrawals: [],
  selectedWithdrawal: null,
  stats: null,

  // Pagination
  total: 0,
  limit: 20,
  offset: 0,

  // Filters
  filters: { ...DEFAULT_FILTERS },

  // UI State
  isLoading: false,
  isLoadingDetail: false,
  isProcessing: false,
  error: null,

  // Fetch paginated withdrawals list
  fetchWithdrawals: async (resetOffset = false) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    const currentFilters = get().filters;
    const filters = resetOffset
      ? { ...currentFilters, offset: 0 }
      : currentFilters;

    if (resetOffset) {
      set({ filters, offset: 0 });
    }

    set({ isLoading: true, error: null });
    try {
      const response = await api.adminGetWithdrawals(token, filters);
      set({
        withdrawals: response.withdrawals,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch withdrawals';
      set({ error: message, isLoading: false });
    }
  },

  // Fetch withdrawals statistics
  fetchStats: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    try {
      const stats = await api.adminGetWithdrawalsStats(token);
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch withdrawals stats:', error);
    }
  },

  // Fetch single withdrawal details
  fetchWithdrawal: async (id: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return null;
    }

    set({ isLoadingDetail: true, error: null });
    try {
      const withdrawal = await api.adminGetWithdrawal(token, id);
      set({ selectedWithdrawal: withdrawal, isLoadingDetail: false });
      return withdrawal;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch withdrawal';
      set({ error: message, isLoadingDetail: false, selectedWithdrawal: null });
      return null;
    }
  },

  // Approve withdrawal
  approveWithdrawal: async (id: string, note?: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isProcessing: true, error: null });
    try {
      const updated = await api.adminApproveWithdrawal(token, id, note);

      // Update withdrawal in list
      set((state) => ({
        withdrawals: state.withdrawals.map((w) =>
          w.id === id ? { ...w, status: 'processing' } : w,
        ),
        selectedWithdrawal: state.selectedWithdrawal?.id === id ? updated : state.selectedWithdrawal,
        isProcessing: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to approve withdrawal';
      set({ error: message, isProcessing: false });
      throw error;
    }
  },

  // Complete withdrawal
  completeWithdrawal: async (id: string, txSignature: string, note?: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isProcessing: true, error: null });
    try {
      const updated = await api.adminCompleteWithdrawal(token, id, txSignature, note);

      // Update withdrawal in list
      set((state) => ({
        withdrawals: state.withdrawals.map((w) =>
          w.id === id ? { ...w, status: 'completed', txSignature } : w,
        ),
        selectedWithdrawal: state.selectedWithdrawal?.id === id ? updated : state.selectedWithdrawal,
        isProcessing: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to complete withdrawal';
      set({ error: message, isProcessing: false });
      throw error;
    }
  },

  // Reject withdrawal
  rejectWithdrawal: async (id: string, reason: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isProcessing: true, error: null });
    try {
      const updated = await api.adminRejectWithdrawal(token, id, reason);

      // Update withdrawal in list
      set((state) => ({
        withdrawals: state.withdrawals.map((w) =>
          w.id === id ? { ...w, status: 'cancelled', errorMessage: reason } : w,
        ),
        selectedWithdrawal: state.selectedWithdrawal?.id === id ? updated : state.selectedWithdrawal,
        isProcessing: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reject withdrawal';
      set({ error: message, isProcessing: false });
      throw error;
    }
  },

  // Filter actions
  setSearch: (search: string) => {
    set((state) => ({
      filters: { ...state.filters, search: search || undefined },
    }));
  },

  setStatus: (status: WithdrawalStatusFilter) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
  },

  setSortBy: (sortBy: WithdrawalSortField) => {
    set((state) => ({
      filters: { ...state.filters, sortBy },
    }));
  },

  setSortOrder: (sortOrder: SortOrder) => {
    set((state) => ({
      filters: { ...state.filters, sortOrder },
    }));
  },

  setPage: (page: number) => {
    const { limit } = get();
    set((state) => ({
      filters: { ...state.filters, offset: page * limit },
      offset: page * limit,
    }));
  },

  resetFilters: () => {
    set({ filters: { ...DEFAULT_FILTERS } });
  },

  // Utility
  clearError: () => set({ error: null }),
  clearSelectedWithdrawal: () => set({ selectedWithdrawal: null }),
}));
