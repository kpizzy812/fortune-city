'use client';

import { create } from 'zustand';
import {
  api,
  AdminSettingsResponse,
  UpdateSettingsRequest,
} from '@/lib/api';
import { useAdminAuthStore } from './admin-auth.store';

interface AdminSettingsState {
  settings: AdminSettingsResponse | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;

  // Actions
  fetchSettings: () => Promise<void>;
  updateSettings: (data: UpdateSettingsRequest) => Promise<AdminSettingsResponse>;
  resetSettings: () => Promise<void>;
  clearError: () => void;
}

export const useAdminSettingsStore = create<AdminSettingsState>((set) => ({
  settings: null,
  isLoading: false,
  isSaving: false,
  error: null,

  fetchSettings: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      set({ error: 'Not authenticated' });
      return;
    }

    set({ isLoading: true, error: null });
    try {
      const settings = await api.adminGetSettings(token);
      set({ settings, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch settings';
      set({ error: message, isLoading: false });
    }
  },

  updateSettings: async (data: UpdateSettingsRequest) => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isSaving: true, error: null });
    try {
      const settings = await api.adminUpdateSettings(token, data);
      set({ settings, isSaving: false });
      return settings;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update settings';
      set({ error: message, isSaving: false });
      throw error;
    }
  },

  resetSettings: async () => {
    const token = useAdminAuthStore.getState().token;
    if (!token) {
      throw new Error('Not authenticated');
    }

    set({ isSaving: true, error: null });
    try {
      const settings = await api.adminResetSettings(token);
      set({ settings, isSaving: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset settings';
      set({ error: message, isSaving: false });
      throw error;
    }
  },

  clearError: () => set({ error: null }),
}));
