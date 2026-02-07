'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type { TreasuryInfoData } from '@/lib/api';

interface TreasuryState {
  info: TreasuryInfoData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  fetchInfo: () => Promise<void>;
}

// Cache 60 seconds
const CACHE_DURATION_MS = 60 * 1000;

export const useTreasuryStore = create<TreasuryState>()((set, get) => ({
  info: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchInfo: async () => {
    const { lastFetchedAt, isLoading } = get();

    if (lastFetchedAt && Date.now() - lastFetchedAt < CACHE_DURATION_MS) {
      return;
    }

    if (isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const data = await api.getTreasuryInfo();
      set({
        info: data,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch treasury info';
      set({ error: message, isLoading: false });
    }
  },
}));
