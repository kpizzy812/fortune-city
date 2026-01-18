'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';
import { api, UserData, TelegramLoginWidgetData } from '@/lib/api';
import { getReferralCode, clearReferralCode } from '@/lib/referral';
import { supabase } from '@/lib/supabase';

interface AuthState {
  token: string | null;
  user: UserData | null;
  isLoading: boolean;
  error: string | null;
  supabaseSession: Session | null;

  // Actions
  setAuth: (token: string, user: UserData) => void;
  clearAuth: () => void;
  authWithInitData: (initData: string) => Promise<void>;
  authWithLoginWidget: (data: TelegramLoginWidgetData) => Promise<void>;
  devLogin: () => Promise<void>;
  refreshUser: () => Promise<void>;

  // Email/Supabase Auth
  sendMagicLink: (email: string) => Promise<void>;
  handleSupabaseCallback: () => Promise<void>;
  linkTelegram: (data: TelegramLoginWidgetData) => Promise<void>;
  linkEmail: () => Promise<void>;

  // Web3/Wallet Auth
  signInWithWeb3: () => Promise<void>;
  linkWeb3: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isLoading: false,
      error: null,
      supabaseSession: null,

      setAuth: (token, user) => {
        set({ token, user, error: null });
      },

      clearAuth: () => {
        supabase.auth.signOut(); // Выходим из Supabase
        set({ token: null, user: null, supabaseSession: null, error: null });
      },

      authWithInitData: async (initData) => {
        set({ isLoading: true, error: null });
        try {
          const referralCode = getReferralCode() ?? undefined;
          const response = await api.authWithInitData(initData, referralCode);
          // Clear referral code after successful auth (it's applied on server for new users)
          clearReferralCode();
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
          const referralCode = getReferralCode() ?? undefined;
          const response = await api.authWithLoginWidget(data, referralCode);
          // Clear referral code after successful auth (it's applied on server for new users)
          clearReferralCode();
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

      // ============ Email/Supabase Auth ============

      sendMagicLink: async (email: string) => {
        set({ isLoading: true, error: null });
        try {
          const referralCode = getReferralCode() ?? undefined;

          const { error } = await supabase.auth.signInWithOtp({
            email,
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback${referralCode ? `?ref=${referralCode}` : ''}`,
            },
          });

          if (error) throw error;

          set({ isLoading: false });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to send magic link';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      handleSupabaseCallback: async () => {
        set({ isLoading: true, error: null });
        try {
          const {
            data: { session },
            error,
          } = await supabase.auth.getSession();

          if (error) throw error;
          if (!session) throw new Error('No session found');

          set({ supabaseSession: session });

          // Авторизуемся на нашем бэкенде
          const referralCode = getReferralCode() ?? undefined;
          const response = await api.authWithSupabase(
            session.access_token,
            referralCode,
          );

          clearReferralCode();
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Auth callback failed';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      linkTelegram: async (data: TelegramLoginWidgetData) => {
        const { token } = get();
        if (!token) throw new Error('Not authenticated');

        set({ isLoading: true, error: null });
        try {
          const response = await api.linkTelegram(token, data);
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to link Telegram';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      linkEmail: async () => {
        const { token, supabaseSession } = get();
        if (!token) throw new Error('Not authenticated');
        if (!supabaseSession) throw new Error('No Supabase session');

        set({ isLoading: true, error: null });
        try {
          const response = await api.linkEmail(token, supabaseSession.access_token);
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to link email';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      // ============ Web3/Wallet Auth ============

      signInWithWeb3: async () => {
        set({ isLoading: true, error: null });
        try {
          // Sign in with Solana wallet via Supabase
          const { data, error } = await supabase.auth.signInWithWeb3({
            chain: 'solana',
            statement: 'Sign in to Fortune City',
          });

          if (error) throw error;
          if (!data.session) throw new Error('No session returned');

          set({ supabaseSession: data.session });

          // Авторизуемся на нашем бэкенде
          const referralCode = getReferralCode() ?? undefined;
          const response = await api.authWithWeb3(
            data.session.access_token,
            referralCode,
          );

          clearReferralCode();
          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to sign in with wallet';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      linkWeb3: async () => {
        const { token } = get();
        if (!token) throw new Error('Not authenticated');

        set({ isLoading: true, error: null });
        try {
          // Sign in with Solana wallet via Supabase
          const { data, error } = await supabase.auth.signInWithWeb3({
            chain: 'solana',
            statement: 'Link wallet to Fortune City account',
          });

          if (error) throw error;
          if (!data.session) throw new Error('No session returned');

          set({ supabaseSession: data.session });

          // Привязываем кошелёк на нашем бэкенде
          const response = await api.linkWeb3(token, data.session.access_token);

          set({
            token: response.accessToken,
            user: response.user,
            isLoading: false,
          });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Failed to link wallet';
          set({ error: message, isLoading: false });
          throw error;
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
