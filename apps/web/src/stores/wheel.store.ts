'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type {
  WheelMultiplier,
  WheelSector,
  WheelSpinResponse,
  WheelStateResponse,
  WheelHistoryItem,
  WheelJackpotResponse,
} from '@/lib/api';

interface WheelState {
  // State
  jackpotPool: number;
  jackpotCap: number;
  betAmount: number;
  multipliers: number[];
  freeSpinsRemaining: number;
  sectors: WheelSector[];
  lastWinner: {
    userId: string;
    amount: number | null;
    wonAt: string | null;
  } | null;
  timesWon: number;
  totalPaidOut: number;

  // Spin result
  lastSpinResult: WheelSpinResponse | null;

  // History
  history: WheelHistoryItem[];
  historyTotal: number;
  historyPage: number;

  // Loading states
  isLoadingState: boolean;
  isSpinning: boolean;
  isLoadingHistory: boolean;

  // Error
  error: string | null;

  // Actions
  fetchState: (token: string) => Promise<void>;
  fetchJackpot: () => Promise<void>;
  spin: (token: string, multiplier: WheelMultiplier) => Promise<WheelSpinResponse>;
  fetchHistory: (token: string, page?: number) => Promise<void>;
  clearLastResult: () => void;
  clearError: () => void;
  reset: () => void;
}

const initialState = {
  jackpotPool: 0,
  jackpotCap: 1000,
  betAmount: 1,
  multipliers: [1, 5, 10, 25, 50],
  freeSpinsRemaining: 0,
  sectors: [],
  lastWinner: null,
  timesWon: 0,
  totalPaidOut: 0,
  lastSpinResult: null,
  history: [],
  historyTotal: 0,
  historyPage: 1,
  isLoadingState: false,
  isSpinning: false,
  isLoadingHistory: false,
  error: null,
};

export const useWheelStore = create<WheelState>((set) => ({
  ...initialState,

  fetchState: async (token: string) => {
    set({ isLoadingState: true, error: null });
    try {
      const state: WheelStateResponse = await api.getWheelState(token);
      set({
        jackpotPool: state.jackpotPool,
        jackpotCap: state.jackpotCap,
        betAmount: state.betAmount,
        multipliers: state.multipliers,
        freeSpinsRemaining: state.freeSpinsRemaining,
        sectors: state.sectors,
        lastWinner: state.lastWinner,
        timesWon: state.timesWon,
        totalPaidOut: state.totalPaidOut,
        isLoadingState: false,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load wheel state';
      set({ error: message, isLoadingState: false });
    }
  },

  fetchJackpot: async () => {
    try {
      const jackpot: WheelJackpotResponse = await api.getWheelJackpot();
      set({
        jackpotPool: jackpot.currentPool,
        timesWon: jackpot.timesWon,
        lastWinner: jackpot.lastWinner
          ? {
              userId: jackpot.lastWinner,
              amount: jackpot.lastAmount,
              wonAt: null,
            }
          : null,
      });
    } catch {
      // Silent fail for jackpot refresh
    }
  },

  spin: async (token: string, multiplier: WheelMultiplier) => {
    set({ isSpinning: true, error: null, lastSpinResult: null });
    try {
      const result = await api.wheelSpin(token, multiplier);
      set({
        lastSpinResult: result,
        freeSpinsRemaining: result.freeSpinsRemaining,
        jackpotPool: result.currentJackpotPool,
        isSpinning: false,
      });
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Spin failed';
      set({ error: message, isSpinning: false });
      throw e;
    }
  },

  fetchHistory: async (token: string, page: number = 1) => {
    set({ isLoadingHistory: true });
    try {
      const history = await api.getWheelHistory(token, page, 10);
      set({
        history: history.items,
        historyTotal: history.total,
        historyPage: history.page,
        isLoadingHistory: false,
      });
    } catch {
      set({ isLoadingHistory: false });
    }
  },

  clearLastResult: () => set({ lastSpinResult: null }),

  clearError: () => set({ error: null }),

  reset: () => set(initialState),
}));
