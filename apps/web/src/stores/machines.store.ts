'use client';

import { create } from 'zustand';
import { api } from '@/lib/api';
import type {
  TierInfo,
  Machine,
  MachineIncome,
  CanAffordResponse,
  PurchaseResult,
  RiskyCollectResult,
  GambleInfo,
  UpgradeGambleResult,
} from '@/types';

interface MachinesState {
  // State
  machines: Machine[];
  tiers: TierInfo[];
  incomes: Record<string, MachineIncome>;
  affordability: Record<number, CanAffordResponse>;
  lastGambleResult: RiskyCollectResult | null;
  gambleInfos: Record<string, GambleInfo>;

  // Loading states
  isLoadingMachines: boolean;
  isLoadingTiers: boolean;
  isPurchasing: boolean;
  isCollecting: Record<string, boolean>;

  // Error
  error: string | null;

  // Actions
  fetchTiers: () => Promise<void>;
  fetchMachines: (token: string, status?: string) => Promise<void>;
  fetchMachineIncome: (token: string, machineId: string) => Promise<void>;
  fetchAllIncomes: (token: string) => Promise<void>;
  checkAffordability: (token: string, tier: number) => Promise<void>;
  checkAllAffordability: (token: string, maxTier: number) => Promise<void>;
  purchaseMachine: (token: string, tier: number) => Promise<PurchaseResult>;
  collectCoins: (token: string, machineId: string) => Promise<number>;
  riskyCollect: (token: string, machineId: string) => Promise<RiskyCollectResult>;
  upgradeGamble: (token: string, machineId: string) => Promise<UpgradeGambleResult>;
  fetchGambleInfo: (token: string, machineId: string) => Promise<void>;

  // Real-time income interpolation
  interpolateIncome: (machineId: string) => void;
  interpolateAllIncomes: () => void;

  // Clear
  clearError: () => void;
  clearLastGambleResult: () => void;
  reset: () => void;
}

export const useMachinesStore = create<MachinesState>((set, get) => ({
  // Initial state
  machines: [],
  tiers: [],
  incomes: {},
  affordability: {},
  lastGambleResult: null,
  gambleInfos: {},
  isLoadingMachines: false,
  isLoadingTiers: false,
  isPurchasing: false,
  isCollecting: {},
  error: null,

  fetchTiers: async () => {
    set({ isLoadingTiers: true, error: null });
    try {
      const tiers = await api.getTiers();
      set({ tiers, isLoadingTiers: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load tiers';
      set({ error: message, isLoadingTiers: false });
    }
  },

  fetchMachines: async (token, status) => {
    set({ isLoadingMachines: true, error: null });
    try {
      const machines = await api.getMachines(token, status);
      set({ machines, isLoadingMachines: false });
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Failed to load machines';
      set({ error: message, isLoadingMachines: false });
    }
  },

  fetchMachineIncome: async (token, machineId) => {
    try {
      const income = await api.getMachineIncome(token, machineId);
      set((state) => ({
        incomes: { ...state.incomes, [machineId]: income },
      }));
    } catch {
      // Silent fail for income refresh
    }
  },

  fetchAllIncomes: async (token) => {
    const { machines } = get();
    const activeMachines = machines.filter((m) => m.status === 'active');

    await Promise.all(
      activeMachines.map((m) => get().fetchMachineIncome(token, m.id))
    );
  },

  checkAffordability: async (token, tier) => {
    try {
      const result = await api.canAfford(token, tier);
      set((state) => ({
        affordability: { ...state.affordability, [tier]: result },
      }));
    } catch {
      // Silent fail
    }
  },

  checkAllAffordability: async (token, maxTier) => {
    // Check affordability for current max tier and next tier
    const tiersToCheck = [maxTier, maxTier + 1].filter((t) => t >= 1 && t <= 10);

    await Promise.all(
      tiersToCheck.map((tier) => get().checkAffordability(token, tier))
    );
  },

  purchaseMachine: async (token, tier) => {
    set({ isPurchasing: true, error: null });
    try {
      const result = await api.purchaseMachine(token, tier);
      // Add new machine to list
      set((state) => ({
        machines: [...state.machines, result.machine],
        isPurchasing: false,
      }));
      return result;
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Purchase failed';
      set({ error: message, isPurchasing: false });
      throw e;
    }
  },

  collectCoins: async (token, machineId) => {
    set((state) => ({
      isCollecting: { ...state.isCollecting, [machineId]: true },
    }));
    try {
      const result = await api.collectCoins(token, machineId);
      // Update machine in list
      set((state) => ({
        machines: state.machines.map((m) =>
          m.id === machineId ? result.machine : m
        ),
        // Reset income for this machine
        incomes: {
          ...state.incomes,
          [machineId]: {
            ...state.incomes[machineId],
            accumulated: 0,
            coinBoxCurrent: 0,
            isFull: false,
          },
        },
        isCollecting: { ...state.isCollecting, [machineId]: false },
      }));
      return result.collected;
    } catch (e) {
      set((state) => ({
        isCollecting: { ...state.isCollecting, [machineId]: false },
      }));
      throw e;
    }
  },

  riskyCollect: async (token, machineId) => {
    set((state) => ({
      isCollecting: { ...state.isCollecting, [machineId]: true },
    }));
    try {
      const result = await api.collectCoinsRisky(token, machineId);
      // Update machine in list and store gamble result
      set((state) => ({
        machines: state.machines.map((m) =>
          m.id === machineId ? result.machine : m
        ),
        // Reset income for this machine
        incomes: {
          ...state.incomes,
          [machineId]: {
            ...state.incomes[machineId],
            accumulated: 0,
            coinBoxCurrent: 0,
            isFull: false,
          },
        },
        lastGambleResult: result,
        isCollecting: { ...state.isCollecting, [machineId]: false },
      }));
      return result;
    } catch (e) {
      set((state) => ({
        isCollecting: { ...state.isCollecting, [machineId]: false },
      }));
      throw e;
    }
  },

  upgradeGamble: async (token, machineId) => {
    try {
      const result = await api.upgradeFortuneGamble(token, machineId);
      // Update machine in list
      set((state) => ({
        machines: state.machines.map((m) =>
          m.id === machineId ? result.machine : m
        ),
        // Invalidate gamble info cache for this machine
        gambleInfos: {
          ...state.gambleInfos,
          [machineId]: {
            currentLevel: result.newLevel,
            currentWinChance: result.newWinChance,
            currentEV: 0, // Will be refreshed
            canUpgrade: true,
            nextLevel: null,
            nextWinChance: null,
            nextEV: null,
            upgradeCost: null,
          },
        },
      }));
      return result;
    } catch (e) {
      throw e;
    }
  },

  fetchGambleInfo: async (token, machineId) => {
    try {
      const info = await api.getGambleInfo(token, machineId);
      set((state) => ({
        gambleInfos: { ...state.gambleInfos, [machineId]: info },
      }));
    } catch {
      // Silent fail
    }
  },

  // Client-side income interpolation (every second)
  interpolateIncome: (machineId) => {
    const { incomes, machines } = get();
    const income = incomes[machineId];
    const machine = machines.find((m) => m.id === machineId);

    if (!income || !machine || machine.status !== 'active') return;

    const newAccumulated = Math.min(
      income.accumulated + income.ratePerSecond,
      income.coinBoxCapacity
    );

    set((state) => ({
      incomes: {
        ...state.incomes,
        [machineId]: {
          ...income,
          accumulated: newAccumulated,
          coinBoxCurrent: newAccumulated,
          isFull: newAccumulated >= income.coinBoxCapacity,
          secondsUntilFull: Math.max(
            0,
            (income.coinBoxCapacity - newAccumulated) / income.ratePerSecond
          ),
        },
      },
    }));
  },

  interpolateAllIncomes: () => {
    const { machines } = get();
    const activeMachines = machines.filter((m) => m.status === 'active');

    activeMachines.forEach((machine) => {
      get().interpolateIncome(machine.id);
    });
  },

  clearError: () => set({ error: null }),

  clearLastGambleResult: () => set({ lastGambleResult: null }),

  reset: () =>
    set({
      machines: [],
      tiers: [],
      incomes: {},
      affordability: {},
      lastGambleResult: null,
      gambleInfos: {},
      isLoadingMachines: false,
      isLoadingTiers: false,
      isPurchasing: false,
      isCollecting: {},
      error: null,
    }),
}));
