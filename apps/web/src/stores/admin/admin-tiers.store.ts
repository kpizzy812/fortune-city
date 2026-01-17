'use client';

import { create } from 'zustand';
import {
  api,
  AdminTierResponse,
  AdminTierStats,
  CreateTierRequest,
  UpdateTierRequest,
} from '@/lib/api';
import { useAdminAuthStore } from './admin-auth.store';

interface AdminTiersState {
  tiers: AdminTierResponse[];
  stats: AdminTierStats | null;
  selectedTier: AdminTierResponse | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchTiers: () => Promise<void>;
  fetchStats: () => Promise<void>;
  fetchTier: (tier: number) => Promise<AdminTierResponse | null>;
  createTier: (data: CreateTierRequest) => Promise<AdminTierResponse>;
  updateTier: (tier: number, data: UpdateTierRequest) => Promise<AdminTierResponse>;
  deleteTier: (tier: number) => Promise<{ success: boolean; message: string }>;
  toggleVisibility: (tier: number) => Promise<void>;
  toggleAvailability: (tier: number) => Promise<void>;
  clearError: () => void;
  clearSelectedTier: () => void;
}

export const useAdminTiersStore = create<AdminTiersState>((set, get) => ({
  tiers: [],
  stats: null,
  selectedTier: null,
  isLoading: false,
  error: null,

  fetchTiers: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const tiers = await api.adminGetAllTiers(token);
      set({ tiers, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tiers';
      set({ error: message, isLoading: false });
    }
  },

  fetchStats: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    try {
      const stats = await api.adminGetTierStats(token);
      set({ stats });
    } catch (error) {
      console.error('Failed to fetch tier stats:', error);
    }
  },

  fetchTier: async (tier: number) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return null;
    }

    set({ isLoading: true, error: null });
    try {
      const tierData = await api.adminGetTier(token, tier);
      set({ selectedTier: tierData, isLoading: false });
      return tierData;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch tier';
      set({ error: message, isLoading: false, selectedTier: null });
      return null;
    }
  },

  createTier: async (data: CreateTierRequest) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isLoading: true, error: null });
    try {
      const newTier = await api.adminCreateTier(token, data);
      set((state) => ({
        tiers: [...state.tiers, newTier].sort((a, b) => a.sortOrder - b.sortOrder),
        isLoading: false,
      }));
      return newTier;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to create tier';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  updateTier: async (tier: number, data: UpdateTierRequest) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isLoading: true, error: null });
    try {
      const updated = await api.adminUpdateTier(token, tier, data);
      set((state) => ({
        tiers: state.tiers
          .map((t) => (t.tier === tier ? updated : t))
          .sort((a, b) => a.sortOrder - b.sortOrder),
        selectedTier: state.selectedTier?.tier === tier ? updated : state.selectedTier,
        isLoading: false,
      }));
      return updated;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update tier';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  deleteTier: async (tier: number) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isLoading: true, error: null });
    try {
      const result = await api.adminDeleteTier(token, tier);

      // If tier was hidden (soft delete), update it in state
      // If tier was deleted (hard delete), remove it from state
      if (result.message.includes('hidden')) {
        set((state) => ({
          tiers: state.tiers.map((t) =>
            t.tier === tier ? { ...t, isVisible: false } : t
          ),
          isLoading: false,
        }));
      } else {
        set((state) => ({
          tiers: state.tiers.filter((t) => t.tier !== tier),
          isLoading: false,
        }));
      }

      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete tier';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  toggleVisibility: async (tier: number) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    const currentTier = get().tiers.find((t) => t.tier === tier);
    if (!currentTier) return;

    try {
      const updated = await api.adminUpdateTierVisibility(
        token,
        tier,
        !currentTier.isVisible,
      );
      set((state) => ({
        tiers: state.tiers.map((t) => (t.tier === tier ? updated : t)),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle visibility';
      set({ error: message });
    }
  },

  toggleAvailability: async (tier: number) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) return;

    const currentTier = get().tiers.find((t) => t.tier === tier);
    if (!currentTier) return;

    try {
      const updated = await api.adminUpdateTierAvailability(
        token,
        tier,
        !currentTier.isPubliclyAvailable,
      );
      set((state) => ({
        tiers: state.tiers.map((t) => (t.tier === tier ? updated : t)),
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to toggle availability';
      set({ error: message });
    }
  },

  clearError: () => set({ error: null }),

  clearSelectedTier: () => set({ selectedTier: null }),
}));
