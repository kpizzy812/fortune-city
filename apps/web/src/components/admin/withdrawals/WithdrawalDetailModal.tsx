'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  ExternalLink,
  AlertCircle,
  User,
  Wallet,
  Receipt,
} from 'lucide-react';
import { useAdminWithdrawalsStore } from '@/stores/admin/admin-withdrawals.store';

interface WithdrawalDetailModalProps {
  withdrawalId: string;
  onClose: () => void;
}

export function WithdrawalDetailModal({
  withdrawalId,
  onClose,
}: WithdrawalDetailModalProps) {
  const {
    selectedWithdrawal,
    isLoadingDetail,
    isProcessing,
    error,
    fetchWithdrawal,
    approveWithdrawal,
    completeWithdrawal,
    rejectWithdrawal,
    clearSelectedWithdrawal,
    clearError,
    fetchWithdrawals,
    fetchStats,
  } = useAdminWithdrawalsStore();

  const [actionMode, setActionMode] = useState<'none' | 'complete' | 'reject'>('none');
  const [txSignature, setTxSignature] = useState('');
  const [reason, setReason] = useState('');

  useEffect(() => {
    fetchWithdrawal(withdrawalId);
    return () => clearSelectedWithdrawal();
  }, [withdrawalId, fetchWithdrawal, clearSelectedWithdrawal]);

  const handleApprove = async () => {
    try {
      await approveWithdrawal(withdrawalId);
      fetchWithdrawals();
      fetchStats();
    } catch {
      // Error handled by store
    }
  };

  const handleComplete = async () => {
    if (!txSignature.trim()) return;
    try {
      await completeWithdrawal(withdrawalId, txSignature.trim());
      fetchWithdrawals();
      fetchStats();
      onClose();
    } catch {
      // Error handled by store
    }
  };

  const handleReject = async () => {
    if (!reason.trim()) return;
    try {
      await rejectWithdrawal(withdrawalId, reason.trim());
      fetchWithdrawals();
      fetchStats();
      onClose();
    } catch {
      // Error handled by store
    }
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 8,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-yellow-500/10 text-yellow-400 rounded-lg text-sm font-medium">
            <Clock className="w-4 h-4" />
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium">
            <Loader2 className="w-4 h-4 animate-spin" />
            Processing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-slate-500/10 text-slate-400 rounded-lg text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Cancelled
          </span>
        );
      default:
        return status;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 rounded-xl border border-slate-700 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-slate-900 border-b border-slate-700 p-4 flex items-center justify-between">
          <h2 className="text-xl font-bold text-white">Withdrawal Details</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {isLoadingDetail ? (
            <div className="flex items-center justify-center h-48">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
            </div>
          ) : selectedWithdrawal ? (
            <>
              {/* Status */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedWithdrawal.status)}
                <span className="text-slate-400 text-sm">
                  {formatDate(selectedWithdrawal.createdAt)}
                </span>
              </div>

              {/* Error message */}
              {error && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <p className="text-red-400 text-sm">{error}</p>
                  <button onClick={clearError} className="ml-auto text-red-400 hover:text-red-300">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* User Info */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-300">User</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Username</p>
                    <p className="text-white">
                      {selectedWithdrawal.user.username
                        ? `@${selectedWithdrawal.user.username}`
                        : selectedWithdrawal.user.firstName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Telegram ID</p>
                    <p className="text-white font-mono">{selectedWithdrawal.user.telegramId}</p>
                  </div>
                  {'fortuneBalance' in selectedWithdrawal.user && (
                    <>
                      <div>
                        <p className="text-xs text-slate-500">Balance</p>
                        <p className="text-amber-400">${formatAmount(selectedWithdrawal.user.fortuneBalance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Max Tier</p>
                        <p className="text-white">{selectedWithdrawal.user.maxTierReached}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Wallet Info */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-300">Wallet</h3>
                </div>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-slate-500">Address</p>
                    <p className="text-white font-mono text-sm break-all">
                      {selectedWithdrawal.walletAddress}
                    </p>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <p className="text-xs text-slate-500">Chain</p>
                      <p className="text-white uppercase">{selectedWithdrawal.chain}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Method</p>
                      <p className="text-white">{selectedWithdrawal.method}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Amount Info */}
              <div className="bg-slate-800/50 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <Receipt className="w-4 h-4 text-slate-400" />
                  <h3 className="text-sm font-medium text-slate-300">Amount Details</h3>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-slate-500">Requested</p>
                    <p className="text-white text-lg font-medium">
                      ${formatAmount(selectedWithdrawal.requestedAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Net Amount</p>
                    <p className="text-green-400 text-lg font-medium">
                      ${formatAmount(selectedWithdrawal.netAmount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">From Fresh Deposit</p>
                    <p className="text-white">${formatAmount(selectedWithdrawal.fromFreshDeposit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">From Profit</p>
                    <p className="text-white">${formatAmount(selectedWithdrawal.fromProfit)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Tax ({(selectedWithdrawal.taxRate * 100).toFixed(0)}%)</p>
                    <p className="text-red-400">${formatAmount(selectedWithdrawal.taxAmount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">USDT Amount</p>
                    <p className="text-white">${formatAmount(selectedWithdrawal.usdtAmount)}</p>
                  </div>
                </div>
              </div>

              {/* Transaction Info */}
              {selectedWithdrawal.txSignature && (
                <div className="bg-slate-800/50 rounded-lg p-4">
                  <p className="text-xs text-slate-500 mb-1">Transaction Signature</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono text-sm break-all flex-1">
                      {selectedWithdrawal.txSignature}
                    </p>
                    <a
                      href={`https://solscan.io/tx/${selectedWithdrawal.txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>
              )}

              {/* Error Message */}
              {selectedWithdrawal.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-xs text-red-400 mb-1">Error / Rejection Reason</p>
                  <p className="text-white">{selectedWithdrawal.errorMessage}</p>
                </div>
              )}

              {/* Action Buttons */}
              {(selectedWithdrawal.status === 'pending' || selectedWithdrawal.status === 'processing') && (
                <div className="border-t border-slate-700 pt-4">
                  {actionMode === 'none' && (
                    <div className="flex gap-3">
                      {selectedWithdrawal.status === 'pending' && (
                        <button
                          onClick={handleApprove}
                          disabled={isProcessing}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-blue-600 text-white font-medium
                            hover:bg-blue-500 disabled:opacity-50
                            transition-colors flex items-center justify-center gap-2
                          "
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <>
                              <Clock className="w-4 h-4" />
                              Approve (Move to Processing)
                            </>
                          )}
                        </button>
                      )}
                      <button
                        onClick={() => setActionMode('complete')}
                        className="
                          flex-1 py-2.5 px-4 rounded-lg
                          bg-green-600 text-white font-medium
                          hover:bg-green-500 transition-colors
                          flex items-center justify-center gap-2
                        "
                      >
                        <CheckCircle className="w-4 h-4" />
                        Complete
                      </button>
                      <button
                        onClick={() => setActionMode('reject')}
                        className="
                          flex-1 py-2.5 px-4 rounded-lg
                          bg-red-600 text-white font-medium
                          hover:bg-red-500 transition-colors
                          flex items-center justify-center gap-2
                        "
                      >
                        <XCircle className="w-4 h-4" />
                        Reject
                      </button>
                    </div>
                  )}

                  {actionMode === 'complete' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">
                          Transaction Signature *
                        </label>
                        <input
                          type="text"
                          value={txSignature}
                          onChange={(e) => setTxSignature(e.target.value)}
                          placeholder="Enter tx signature..."
                          className="
                            w-full px-4 py-2
                            bg-slate-800 border border-slate-700
                            rounded-lg text-white placeholder-slate-500
                            focus:outline-none focus:border-green-500
                          "
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setActionMode('none')}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-slate-700 text-white font-medium
                            hover:bg-slate-600 transition-colors
                          "
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleComplete}
                          disabled={isProcessing || !txSignature.trim()}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-green-600 text-white font-medium
                            hover:bg-green-500 disabled:opacity-50
                            transition-colors flex items-center justify-center gap-2
                          "
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Confirm Complete'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {actionMode === 'reject' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">
                          Rejection Reason *
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Enter reason for rejection..."
                          rows={3}
                          className="
                            w-full px-4 py-2
                            bg-slate-800 border border-slate-700
                            rounded-lg text-white placeholder-slate-500
                            focus:outline-none focus:border-red-500
                            resize-none
                          "
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => setActionMode('none')}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-slate-700 text-white font-medium
                            hover:bg-slate-600 transition-colors
                          "
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleReject}
                          disabled={isProcessing || !reason.trim()}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-red-600 text-white font-medium
                            hover:bg-red-500 disabled:opacity-50
                            transition-colors flex items-center justify-center gap-2
                          "
                        >
                          {isProcessing ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            'Confirm Reject'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-48 text-slate-400">
              Withdrawal not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
