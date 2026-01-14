'use client';

import { create } from 'zustand';
import {
  api,
  WithdrawalData,
  WithdrawalPreviewData,
  PreparedAtomicWithdrawalData,
  InstantWithdrawalData,
} from '@/lib/api';

interface WithdrawalsState {
  // Data
  withdrawals: WithdrawalData[];
  preview: WithdrawalPreviewData | null;
  preparedWithdrawal: PreparedAtomicWithdrawalData | null;

  // Loading states
  isLoading: boolean;
  isPreviewing: boolean;
  isPreparing: boolean;
  isConfirming: boolean;
  isProcessing: boolean;

  // Error
  error: string | null;

  // Actions
  fetchWithdrawals: (token: string) => Promise<void>;
  previewWithdrawal: (token: string, amount: number) => Promise<WithdrawalPreviewData>;
  prepareAtomicWithdrawal: (
    token: string,
    amount: number,
    walletAddress: string,
  ) => Promise<PreparedAtomicWithdrawalData>;
  confirmAtomicWithdrawal: (
    token: string,
    withdrawalId: string,
    txSignature: string,
  ) => Promise<WithdrawalData>;
  cancelAtomicWithdrawal: (token: string, withdrawalId: string) => Promise<void>;
  createInstantWithdrawal: (
    token: string,
    amount: number,
    walletAddress: string,
  ) => Promise<InstantWithdrawalData>;
  clearPreparedWithdrawal: () => void;
  clearPreview: () => void;
  clearError: () => void;
}

export const useWithdrawalsStore = create<WithdrawalsState>()((set) => ({
  // Initial state
  withdrawals: [],
  preview: null,
  preparedWithdrawal: null,
  isLoading: false,
  isPreviewing: false,
  isPreparing: false,
  isConfirming: false,
  isProcessing: false,
  error: null,

  fetchWithdrawals: async (token) => {
    set({ isLoading: true, error: null });
    try {
      const withdrawals = await api.getWithdrawals(token);
      set({ withdrawals, isLoading: false });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to fetch withdrawals';
      set({ error: message, isLoading: false });
    }
  },

  previewWithdrawal: async (token, amount) => {
    set({ isPreviewing: true, error: null });
    try {
      const preview = await api.previewWithdrawal(token, amount);
      set({ preview, isPreviewing: false });
      return preview;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to preview withdrawal';
      set({ error: message, isPreviewing: false });
      throw error;
    }
  },

  prepareAtomicWithdrawal: async (token, amount, walletAddress) => {
    set({ isPreparing: true, error: null });
    try {
      const preparedWithdrawal = await api.prepareAtomicWithdrawal(
        token,
        amount,
        walletAddress,
      );
      set({ preparedWithdrawal, isPreparing: false });
      return preparedWithdrawal;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to prepare withdrawal';
      set({ error: message, isPreparing: false });
      throw error;
    }
  },

  confirmAtomicWithdrawal: async (token, withdrawalId, txSignature) => {
    set({ isConfirming: true, error: null });
    try {
      const withdrawal = await api.confirmAtomicWithdrawal(
        token,
        withdrawalId,
        txSignature,
      );
      // Refresh withdrawals list
      const withdrawals = await api.getWithdrawals(token);
      set({
        withdrawals,
        preparedWithdrawal: null,
        isConfirming: false,
      });
      return withdrawal;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to confirm withdrawal';
      set({ error: message, isConfirming: false });
      throw error;
    }
  },

  cancelAtomicWithdrawal: async (token, withdrawalId) => {
    set({ isLoading: true, error: null });
    try {
      await api.cancelAtomicWithdrawal(token, withdrawalId);
      // Refresh withdrawals list
      const withdrawals = await api.getWithdrawals(token);
      set({
        withdrawals,
        preparedWithdrawal: null,
        isLoading: false,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to cancel withdrawal';
      set({ error: message, isLoading: false });
      throw error;
    }
  },

  createInstantWithdrawal: async (token, amount, walletAddress) => {
    set({ isProcessing: true, error: null });
    try {
      const withdrawal = await api.createInstantWithdrawal(
        token,
        amount,
        walletAddress,
      );
      // Refresh withdrawals list
      const withdrawals = await api.getWithdrawals(token);
      set({
        withdrawals,
        preview: null,
        isProcessing: false,
      });
      return withdrawal;
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to process withdrawal';
      set({ error: message, isProcessing: false });
      throw error;
    }
  },

  clearPreparedWithdrawal: () => {
    set({ preparedWithdrawal: null });
  },

  clearPreview: () => {
    set({ preview: null });
  },

  clearError: () => {
    set({ error: null });
  },
}));
