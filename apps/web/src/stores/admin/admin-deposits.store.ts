'use client';

import { create } from 'zustand';
import {
  api,
  AdminDepositListItem,
  AdminDepositDetail,
  AdminDepositsStatsResponse,
  AdminDepositsFilter,
  DepositSortField,
  DepositStatusFilter,
  SortOrder,
} from '@/lib/api';
import { useAdminAuthStore } from './admin-auth.store';

interface AdminDepositsState {
  // Data
  deposits: AdminDepositListItem[];
  selectedDeposit: AdminDepositDetail | null;
  stats: AdminDepositsStatsResponse | null;

  // Pagination
  total: number;
  limit: number;
  offset: number;

  // Filters
  filters: AdminDepositsFilter;

  // UI State
  isLoading: boolean;
  isLoadingDetail: boolean;
  isProcessing: boolean;
  error: string | null;

  // Actions
  fetchDeposits: (resetOffset?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchDeposit: (id: string) => Promise<AdminDepositDetail | null>;
  creditDeposit: (id: string, reason: string) => Promise<AdminDepositDetail>;
  retryDeposit: (id: string, note?: string) => Promise<AdminDepositDetail>;

  // Filter actions
  setSearch: (search: string) => void;
  setStatus: (status: DepositStatusFilter) => void;
  setCurrency: (currency: string | undefined) => void;
  setSortBy: (sortBy: DepositSortField) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;

  // Utility
  clearError: () => void;
  clearSelectedDeposit: () => void;
}

const DEFAULT_FILTERS: AdminDepositsFilter = {
  limit: 20,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc',
  status: 'all',
};

export const useAdminDepositsStore = create<AdminDepositsState>((set, get) => ({
  // Initial data
  deposits: [],
  selectedDeposit: null,
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

  // Fetch paginated deposits list
  fetchDeposits: async (resetOffset = false) => {
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
      const response = await api.adminGetDeposits(token, filters);
      set({
        deposits: response.deposits,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch deposits';
      set({ error: message, isLoading: false });
    }
  },

  // Fetch deposits statistics
  fetchStats: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    try {
      const stats = await api.adminGetDepositsStats(token);
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch deposits stats:', error);
    }
  },

  // Fetch single deposit details
  fetchDeposit: async (id: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return null;
    }

    set({ isLoadingDetail: true, error: null });
    try {
      const deposit = await api.adminGetDeposit(token, id);
      set({ selectedDeposit: deposit, isLoadingDetail: false });
      return deposit;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch deposit';
      set({ error: message, isLoadingDetail: false, selectedDeposit: null });
      return null;
    }
  },

  // Manually credit a failed deposit
  creditDeposit: async (id: string, reason: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isProcessing: true, error: null });
    try {
      const updated = await api.adminCreditDeposit(token, id, reason);

      // Update deposit in list
      set((state) => ({
        deposits: state.deposits.map((d) =>
          d.id === id ? { ...d, status: 'credited' } : d,
        ),
        selectedDeposit: state.selectedDeposit?.id === id ? updated : state.selectedDeposit,
        isProcessing: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to credit deposit';
      set({ error: message, isProcessing: false });
      throw error;
    }
  },

  // Retry a failed deposit
  retryDeposit: async (id: string, note?: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isProcessing: true, error: null });
    try {
      const updated = await api.adminRetryDeposit(token, id, note);

      // Update deposit in list
      set((state) => ({
        deposits: state.deposits.map((d) =>
          d.id === id ? { ...d, status: 'pending' } : d,
        ),
        selectedDeposit: state.selectedDeposit?.id === id ? updated : state.selectedDeposit,
        isProcessing: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to retry deposit';
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

  setStatus: (status: DepositStatusFilter) => {
    set((state) => ({
      filters: { ...state.filters, status },
    }));
  },

  setCurrency: (currency: string | undefined) => {
    set((state) => ({
      filters: { ...state.filters, currency },
    }));
  },

  setSortBy: (sortBy: DepositSortField) => {
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
  clearSelectedDeposit: () => set({ selectedDeposit: null }),
}));
