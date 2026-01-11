'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { api, UserData, TelegramLoginWidgetData } from '@/lib/api';

interface AuthState {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  setAuth: (token: string, user: UserData) => void;
  clearAuth: () => void;
  authWithInitData: (initData: string) => Promise<void>;
  authWithLoginWidget: (data: TelegramLoginWidgetData) => Promise<void>;
  devLogin: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,

      setAuth: (token, user) => {
        set({ token, user, error: null });
      },

      clearAuth: () => {
        set({ token: null, user: null, error: null });
      },

      authWithInitData: async (initData) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.authWithInitData(initData);
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Auth failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      authWithLoginWidget: async (data) => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.authWithLoginWidget(data);
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Auth failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      devLogin: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await api.devLogin();
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Dev login failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      refreshUser: async () => {
        const { token } = get();
        if (!token) return;

        try {
          const user = await api.getMe(token);
          set({ user });
        } catch {
          // Token expired or invalid
          set({ token: null, user: null });
        }
      },
    }),
    {
      name: 'fortune-city-auth',
      partialize: (state) => ({
        token: state.token,
        user: state.user,
      }),
    },
  ),
);
