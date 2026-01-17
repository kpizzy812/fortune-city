'use client';

import { create } from 'zustand';
import {
  api,
  AdminAuditLogItem,
  AdminAuditStatsResponse,
  AdminAuditFilter,
  SortOrder,
} from '@/lib/api';
import { useAdminAuthStore } from './admin-auth.store';

interface AdminAuditState {
  // Data
  logs: AdminAuditLogItem[];
  stats: AdminAuditStatsResponse | null;
  resourceHistory: AdminAuditLogItem[];

  // Pagination
  total: number;
  limit: number;
  offset: number;

  // Filters
  filters: AdminAuditFilter;

  // UI State
  isLoading: boolean;
  isLoadingHistory: boolean;
  error: string | null;

  // Actions
  fetchLogs: (resetOffset?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchResourceHistory: (resource: string, resourceId: string) => Promise<void>;

  // Filter actions
  setAction: (action: string | undefined) => void;
  setResource: (resource: string | undefined) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;

  // Utility
  clearError: () => void;
  clearResourceHistory: () => void;
}

const DEFAULT_FILTERS: AdminAuditFilter = {
  limit: 50,
  offset: 0,
  sortOrder: 'desc',
};

export const useAdminAuditStore = create<AdminAuditState>((set, get) => ({
  // Initial data
  logs: [],
  stats: null,
  resourceHistory: [],

  // Pagination
  total: 0,
  limit: 50,
  offset: 0,

  // Filters
  filters: { ...DEFAULT_FILTERS },

  // UI State
  isLoading: false,
  isLoadingHistory: false,
  error: null,

  // Fetch paginated audit logs
  fetchLogs: async (resetOffset = false) => {
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
      const response = await api.adminGetAuditLogs(token, filters);
      set({
        logs: response.logs,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch audit logs';
      set({ error: message, isLoading: false });
    }
  },

  // Fetch audit statistics
  fetchStats: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    try {
      const stats = await api.adminGetAuditStats(token);
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch audit stats:', error);
    }
  },

  // Fetch history for a specific resource
  fetchResourceHistory: async (resource: string, resourceId: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoadingHistory: true, error: null });
    try {
      const history = await api.adminGetResourceHistory(token, resource, resourceId);
      set({ resourceHistory: history, isLoadingHistory: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch resource history';
      set({ error: message, isLoadingHistory: false, resourceHistory: [] });
    }
  },

  // Filter actions
  setAction: (action: string | undefined) => {
    set((state) => ({
      filters: { ...state.filters, action },
    }));
  },

  setResource: (resource: string | undefined) => {
    set((state) => ({
      filters: { ...state.filters, resource },
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
  clearResourceHistory: () => set({ resourceHistory: [] }),
}));
