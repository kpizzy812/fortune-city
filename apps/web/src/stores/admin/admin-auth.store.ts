'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface AdminData {
  username: string;
}

interface AdminAuthState {
  token: string | null;
  admin: AdminData | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<boolean>;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      admin: null,
      isLoading: false,
      error: null,

      login: async (username, password) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.adminLogin(username, password);
          set({
            token: response.accessToken,
            admin: response.admin,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: () => {
        set({ token: null, admin: null, error: null });
      },

      checkSession: async () => {
        const { token } = get();
        if (!token) return false;

        try {
          const response = await api.adminGetMe(token);
          set({ admin: response.admin });
          return true;
        } catch {
          // Token expired or invalid
          set({ token: null, admin: null });
          return false;
        }
      },
    }),
    {
      name: 'fortune-city-admin-auth',
      partialize: (state) => ({
        token: state.token,
        admin: state.admin,
      }),
    },
  ),
);
