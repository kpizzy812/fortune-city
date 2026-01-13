'use client';

import { create } from 'zustand';
import { api, FortuneRateData } from '@/lib/api';

interface FortuneRateState {
  rate: FortuneRateData | null;
  isLoading: boolean;
  error: string | null;
  lastFetchedAt: number | null;

  // Computed values
  fortunePerUsd: number;

  // Actions
  fetchRate: () => Promise<void>;
  usdToFortune: (usdAmount: number) => number;
}

// Cache duration: 30 seconds
const CACHE_DURATION_MS = 30 * 1000;

// Fallback rate if API fails
const FALLBACK_FORTUNE_PER_USD = 10;

export const useFortuneRateStore = create<FortuneRateState>()((set, get) => ({
  rate: null,
  isLoading: false,
  error: null,
  lastFetchedAt: null,

  // Default fallback rate
  fortunePerUsd: FALLBACK_FORTUNE_PER_USD,

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
        fortunePerUsd: response.data.fortunePerUsd,
        isLoading: false,
        lastFetchedAt: Date.now(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch rate';
      set({
        error: message,
        isLoading: false,
        // Keep fallback rate
        fortunePerUsd: FALLBACK_FORTUNE_PER_USD,
      });
    }
  },

  usdToFortune: (usdAmount: number) => {
    const { fortunePerUsd } = get();
    return usdAmount * fortunePerUsd;
  },
}));
