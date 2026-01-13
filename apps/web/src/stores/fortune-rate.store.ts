'use client';

import { create } from 'zustand';
import { api, FortuneRateData } from '@/lib/api';

interface FortuneRateState {
  rate: FortuneRateData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  // Actions
  fetchRate: () => Promise<void>;
  usdToFortune: (usdAmount: number) => number | null;
  isRateAvailable: () => boolean;
}

// Cache duration: 30 seconds
const CACHE_DURATION_MS = 30 * 1000;

export const useFortuneRateStore = create<FortuneRateState>()((set, get) => ({
  rate: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  fetchRate: async () => {
    const { lastFetchedAt, isLoading } = get();

    // Check cache validity
    if (lastFetchedAt && Date.now() - lastFetchedAt < CACHE_DURATION_MS) {
      return;
    }

    // Prevent duplicate fetches
    if (isLoading) return;

    set({ isLoading: true, error: null });

    try {
      const response = await api.getFortuneRate();
      set({
        rate: response.data,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch rate';
      set({
        error: message,
        isLoading: false,
        rate: null,
      });
    }
  },

  usdToFortune: (usdAmount: number) => {
    const { rate } = get();
    if (!rate || !rate.fortunePerUsd) return null;
    return usdAmount * rate.fortunePerUsd;
  },

  isRateAvailable: () => {
    const { rate } = get();
    return rate !== null && rate.fortunePerUsd !== null;
  },
}));
