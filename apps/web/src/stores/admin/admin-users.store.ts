'use client';

import { create } from 'zustand';
import {
  api,
  AdminUserListItem,
  AdminUserDetail,
  AdminUsersStatsResponse,
  AdminUsersFilter,
  ReferralTreeResponse,
  UserSortField,
  SortOrder,
} from '@/lib/api';
import { useAdminAuthStore } from './admin-auth.store';

interface AdminUsersState {
  // Data
  users: AdminUserListItem[];
  selectedUser: AdminUserDetail | null;
  referralTree: ReferralTreeResponse | null;
  stats: AdminUsersStatsResponse | null;

  // Pagination
  total: number;
  limit: number;
  offset: number;

  // Filters
  filters: AdminUsersFilter;

  // UI State
  isLoading: boolean;
  isLoadingUser: boolean;
  isLoadingTree: boolean;
  error: string | null;

  // Actions
  fetchUsers: (resetOffset?: boolean) => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchUser: (userId: string) => Promise<AdminUserDetail | null>;
  fetchReferralTree: (userId: string) => Promise<void>;
  banUser: (userId: string, reason: string) => Promise<AdminUserDetail>;
  unbanUser: (userId: string, note?: string) => Promise<AdminUserDetail>;

  // Filter actions
  setSearch: (search: string) => void;
  setIsBanned: (isBanned: boolean | undefined) => void;
  setHasReferrer: (hasReferrer: boolean | undefined) => void;
  setMinTier: (minTier: number | undefined) => void;
  setMaxTier: (maxTier: number | undefined) => void;
  setSortBy: (sortBy: UserSortField) => void;
  setSortOrder: (sortOrder: SortOrder) => void;
  setPage: (page: number) => void;
  resetFilters: () => void;

  // Utility
  clearError: () => void;
  clearSelectedUser: () => void;
  clearReferralTree: () => void;
}

const DEFAULT_FILTERS: AdminUsersFilter = {
  limit: 20,
  offset: 0,
  sortBy: 'createdAt',
  sortOrder: 'desc',
};

export const useAdminUsersStore = create<AdminUsersState>((set, get) => ({
  // Initial data
  users: [],
  selectedUser: null,
  referralTree: null,
  stats: null,

  // Pagination
  total: 0,
  limit: 20,
  offset: 0,

  // Filters
  filters: { ...DEFAULT_FILTERS },

  // UI State
  isLoading: false,
  isLoadingUser: false,
  isLoadingTree: false,
  error: null,

  // Fetch paginated users list
  fetchUsers: async (resetOffset = false) => {
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
      const response = await api.adminGetUsers(token, filters);
      set({
        users: response.users,
        total: response.total,
        limit: response.limit,
        offset: response.offset,
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch users';
      set({ error: message, isLoading: false });
    }
  },

  // Fetch users statistics
  fetchStats: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    try {
      const stats = await api.adminGetUsersStats(token);
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch users stats:', error);
    }
  },

  // Fetch single user details
  fetchUser: async (userId: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return null;
    }

    set({ isLoadingUser: true, error: null });
    try {
      const user = await api.adminGetUser(token, userId);
      set({ selectedUser: user, isLoadingUser: false });
      return user;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch user';
      set({ error: message, isLoadingUser: false, selectedUser: null });
      return null;
    }
  },

  // Fetch user's referral tree
  fetchReferralTree: async (userId: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoadingTree: true, error: null });
    try {
      const tree = await api.adminGetReferralTree(token, userId);
      set({ referralTree: tree, isLoadingTree: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch referral tree';
      set({ error: message, isLoadingTree: false, referralTree: null });
    }
  },

  // Ban user
  banUser: async (userId: string, reason: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isLoadingUser: true, error: null });
    try {
      const updated = await api.adminBanUser(token, userId, reason);

      // Update user in list
      set((state) => ({
        users: state.users.map((u) =>
          u.id === userId ? { ...u, isBanned: true, bannedAt: updated.bannedAt } : u,
        ),
        selectedUser: state.selectedUser?.id === userId ? updated : state.selectedUser,
        isLoadingUser: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to ban user';
      set({ error: message, isLoadingUser: false });
      throw error;
    }
  },

  // Unban user
  unbanUser: async (userId: string, note?: string) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isLoadingUser: true, error: null });
    try {
      const updated = await api.adminUnbanUser(token, userId, note);

      // Update user in list
      set((state) => ({
        users: state.users.map((u) =>
          u.id === userId ? { ...u, isBanned: false, bannedAt: null } : u,
        ),
        selectedUser: state.selectedUser?.id === userId ? updated : state.selectedUser,
        isLoadingUser: false,
      }));

      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to unban user';
      set({ error: message, isLoadingUser: false });
      throw error;
    }
  },

  // Filter actions
  setSearch: (search: string) => {
    set((state) => ({
      filters: { ...state.filters, search: search || undefined },
    }));
  },

  setIsBanned: (isBanned: boolean | undefined) => {
    set((state) => ({
      filters: { ...state.filters, isBanned },
    }));
  },

  setHasReferrer: (hasReferrer: boolean | undefined) => {
    set((state) => ({
      filters: { ...state.filters, hasReferrer },
    }));
  },

  setMinTier: (minTier: number | undefined) => {
    set((state) => ({
      filters: { ...state.filters, minTier },
    }));
  },

  setMaxTier: (maxTier: number | undefined) => {
    set((state) => ({
      filters: { ...state.filters, maxTier },
    }));
  },

  setSortBy: (sortBy: UserSortField) => {
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
  clearSelectedUser: () => set({ selectedUser: null }),
  clearReferralTree: () => set({ referralTree: null }),
}));
