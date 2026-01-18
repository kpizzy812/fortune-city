import { create } from 'zustand';

export interface DepositCreditedEvent {
  depositId: string;
  userId: string;
  amount: number;
  currency: string;
  amountUsd: number;
  newBalance: number;
  timestamp: string;
}

type DepositEventCallback = (event: DepositCreditedEvent) => void;

interface DepositEventsState {
  lastEvent: DepositCreditedEvent | null;
  listeners: Set<DepositEventCallback>;

  // Called by the global socket when deposit is credited
  emitEvent: (event: DepositCreditedEvent) => void;

  // Subscribe to events (returns unsubscribe function)
  subscribe: (callback: DepositEventCallback) => () => void;
}

export const useDepositEventsStore = create<DepositEventsState>((set, get) => ({
  lastEvent: null,
  listeners: new Set(),

  emitEvent: (event) => {
    set({ lastEvent: event });
    // Notify all listeners
    get().listeners.forEach((callback) => {
      try {
        callback(event);
      } catch (error) {
        console.error('[DepositEvents] Listener error:', error);
      }
    });
  },

  subscribe: (callback) => {
    const listeners = get().listeners;
    listeners.add(callback);
    set({ listeners: new Set(listeners) });

    // Return unsubscribe function
    return () => {
      const current = get().listeners;
      current.delete(callback);
      set({ listeners: new Set(current) });
    };
  },
}));
