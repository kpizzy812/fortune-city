'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api } from '@/lib/api';

interface AdminData {
  username: string;
}

interface AdminAuthState {
  token: string | null;
  refreshToken: string | null;
  admin: AdminData | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (username: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => void;
  checkSession: () => Promise<boolean>;
  refreshAccessToken: () => Promise<boolean>;
}

export const useAdminAuthStore = create<AdminAuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      admin: null,
      isLoading: false,
      error: null,

      login: async (username, password, rememberMe = false) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.adminLogin(username, password, rememberMe);
          set({
            token: response.accessToken,
            refreshToken: response.refreshToken || null,
            admin: response.admin,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      logout: async () => {
        const { token } = get();
        if (token) {
          try {
            await api.adminLogout(token);
          } catch {
            // Ignore logout errors
          }
        }
        set({ token: null, refreshToken: null, admin: null, error: null });
      },

      checkSession: async () => {
        const { token, refreshToken } = get();

        // If no token, try to refresh if we have a refresh token
        if (!token && refreshToken) {
          return await get().refreshAccessToken();
        }

        if (!token) return false;

        try {
          const response = await api.adminGetMe(token);
          set({ admin: response.admin });
          return true;
        } catch {
          // Token expired, try to refresh if we have a refresh token
          if (refreshToken) {
            return await get().refreshAccessToken();
          }
          // No refresh token, clear session
          set({ token: null, refreshToken: null, admin: null });
          return false;
        }
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        if (!refreshToken) {
          set({ token: null, refreshToken: null, admin: null });
          return false;
        }

        try {
          const response = await api.adminRefreshToken(refreshToken);
          set({
            token: response.accessToken,
            refreshToken: response.refreshToken || null,
            admin: response.admin,
          });
          return true;
        } catch {
          // Refresh failed, clear session
          set({ token: null, refreshToken: null, admin: null });
          return false;
        }
      },
    }),
    {
      name: 'fortune-city-admin-auth',
      partialize: (state) => ({
        token: state.token,
        refreshToken: state.refreshToken,
        admin: state.admin,
      }),
    },
  ),
);
