'use client';

import { create } from 'zustand';
import {
  api,
  DepositData,
  DepositAddressResponse,
  InitiateDepositResponse,
  DepositRatesResponse,
  DepositCurrency,
  WalletConnectionData,
} from '@/lib/api';
import type {
  OtherCryptoNetwork,
  OtherCryptoInstructions,
  InitiateOtherCryptoDepositRequest,
  OtherCryptoDepositResponse,
} from '@/types';

interface DepositsState {
  // Data
  deposits: DepositData[];
  depositAddress: DepositAddressResponse | null;
  connectedWallet: WalletConnectionData | null;
  rates: DepositRatesResponse | null;
  pendingDeposit: InitiateDepositResponse | null;
  otherCryptoInstructions: OtherCryptoInstructions | null;
  pendingOtherCryptoDeposit: OtherCryptoDepositResponse | null;

  // Loading states
  isLoading: boolean;
  isInitiating: boolean;
  isConfirming: boolean;
  isLoadingInstructions: boolean;

  // Error
  error: string | null;

  // Actions
  fetchDeposits: (token: string) => Promise<void>;
  fetchDepositAddress: (token: string) => Promise<void>;
  fetchConnectedWallet: (token: string) => Promise<void>;
  fetchRates: () => Promise<void>;
  connectWallet: (token: string, walletAddress: string) => Promise<void>;
  initiateDeposit: (
    token: string,
    currency: DepositCurrency,
    amount: number,
    walletAddress: string,
  ) => Promise<InitiateDepositResponse>;
  confirmDeposit: (
    token: string,
    depositId: string,
    txSignature: string,
  ) => Promise<void>;
  fetchOtherCryptoInstructions: (network: OtherCryptoNetwork) => Promise<void>;
  initiateOtherCryptoDeposit: (
    token: string,
    data: InitiateOtherCryptoDepositRequest,
  ) => Promise<OtherCryptoDepositResponse>;
  clearPendingDeposit: () => void;
  clearError: () => void;
}

export const useDepositsStore = create<DepositsState>()((set) => ({
  // Initial state
  deposits: [],
  depositAddress: null,
  connectedWallet: null,
  rates: null,
  pendingDeposit: null,
  otherCryptoInstructions: null,
  pendingOtherCryptoDeposit: null,
  isLoading: false,
  isInitiating: false,
  isConfirming: false,
  isLoadingInstructions: false,
  error: null,

  fetchDeposits: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const deposits = await api.getDeposits(token);
      set({ deposits, isLoading: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to fetch deposits';
      set({ error: message, isLoading: false });
    }
  },

  fetchDepositAddress: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const depositAddress = await api.getDepositAddress(token);
      set({ depositAddress, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch deposit address';
      set({ error: message, isLoading: false });
    }
  },

  fetchConnectedWallet: async (token) => {
    try {
      const connectedWallet = await api.getConnectedWallet(token);
      set({ connectedWallet });
    } catch {
      // Silently fail - wallet might not be connected
    }
  },

  fetchRates: async () => {
    try {
      const rates = await api.getDepositRates();
      set({ rates });
    } catch {
      // Silently fail - rates are optional
    }
  },

  connectWallet: async (token, walletAddress) => {
    set({ isLoading: true, error: null });
    try {
      await api.connectWallet(token, walletAddress);
      set({
        connectedWallet: {
          id: '',
          userId: '',
          chain: 'solana',
          walletAddress,
          connectedAt: new Date().toISOString(),
        },
        isLoading: false,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to connect wallet';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  initiateDeposit: async (token, currency, amount, walletAddress) => {
    set({ isInitiating: true, error: null });
    try {
      const pendingDeposit = await api.initiateDeposit(token, {
        currency,
        amount,
        walletAddress,
      });
      set({ pendingDeposit, isInitiating: false });
      return pendingDeposit;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to initiate deposit';
      set({ error: message, isInitiating: false });
      throw error;
    }
  },

  confirmDeposit: async (token, depositId, txSignature) => {
    set({ isConfirming: true, error: null });
    try {
      await api.confirmDeposit(token, depositId, txSignature);
      // Refresh deposits list
      const deposits = await api.getDeposits(token);
      set({ deposits, pendingDeposit: null, isConfirming: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to confirm deposit';
      set({ error: message, isConfirming: false });
      throw error;
    }
  },

  fetchOtherCryptoInstructions: async (network) => {
    set({ isLoadingInstructions: true, error: null });
    try {
      const otherCryptoInstructions = await api.getOtherCryptoInstructions(network);
      set({ otherCryptoInstructions, isLoadingInstructions: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch other crypto instructions';
      set({ error: message, isLoadingInstructions: false });
      throw error;
    }
  },

  initiateOtherCryptoDeposit: async (token, data) => {
    set({ isInitiating: true, error: null });
    try {
      const pendingOtherCryptoDeposit = await api.initiateOtherCryptoDeposit(token, data);
      set({ pendingOtherCryptoDeposit, isInitiating: false });
      // Refresh deposits list
      const deposits = await api.getDeposits(token);
      set({ deposits });
      return pendingOtherCryptoDeposit;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to initiate other crypto deposit';
      set({ error: message, isInitiating: false });
      throw error;
    }
  },

  clearPendingDeposit: () => {
    set({ pendingDeposit: null, pendingOtherCryptoDeposit: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
