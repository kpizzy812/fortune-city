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
  Receipt,
  RefreshCw,
} from 'lucide-react';
import { useAdminDepositsStore } from '@/stores/admin/admin-deposits.store';

interface DepositDetailModalProps {
  depositId: string;
  onClose: () => void;
}

export function DepositDetailModal({
  depositId,
  onClose,
}: DepositDetailModalProps) {
  const {
    selectedDeposit,
    isLoadingDetail,
    isProcessing,
    error,
    fetchDeposit,
    creditDeposit,
    retryDeposit,
    approveOtherCryptoDeposit,
    rejectOtherCryptoDeposit,
    clearSelectedDeposit,
    clearError,
    fetchDeposits,
    fetchStats,
  } = useAdminDepositsStore();

  const [actionMode, setActionMode] = useState<'none' | 'credit' | 'retry' | 'approve_other_crypto' | 'reject_other_crypto'>('none');
  const [reason, setReason] = useState('');
  const [actualAmount, setActualAmount] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchDeposit(depositId);
    return () => clearSelectedDeposit();
  }, [depositId, fetchDeposit, clearSelectedDeposit]);

  const handleCredit = async () => {
    if (!reason.trim()) return;
    try {
      await creditDeposit(depositId, reason.trim());
      fetchDeposits();
      fetchStats();
      onClose();
    } catch {
      // Error handled by store
    }
  };

  const handleRetry = async () => {
    try {
      await retryDeposit(depositId);
      fetchDeposits();
      fetchStats();
    } catch {
      // Error handled by store
    }
  };

  const handleApproveOtherCrypto = async () => {
    const amount = parseFloat(actualAmount);
    if (isNaN(amount) || amount <= 0) return;

    try {
      await approveOtherCryptoDeposit(depositId, amount, notes.trim() || undefined);
      fetchDeposits();
      fetchStats();
      onClose();
    } catch {
      // Error handled by store
    }
  };

  const handleRejectOtherCrypto = async () => {
    if (!reason.trim()) return;

    try {
      await rejectOtherCryptoDeposit(depositId, reason.trim());
      fetchDeposits();
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

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getCurrencyLabel = (currency: string) => {
    switch (currency) {
      case 'SOL':
        return <span className="text-purple-400">SOL</span>;
      case 'USDT_SOL':
        return <span className="text-green-400">USDT</span>;
      case 'FORTUNE':
        return <span className="text-amber-400">FORTUNE</span>;
      default:
        return <span className="text-slate-400">{currency}</span>;
    }
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
      case 'confirmed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-500/10 text-blue-400 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Confirmed
          </span>
        );
      case 'credited':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-lg text-sm font-medium">
            <CheckCircle className="w-4 h-4" />
            Credited
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-500/10 text-red-400 rounded-lg text-sm font-medium">
            <XCircle className="w-4 h-4" />
            Failed
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
          <h2 className="text-xl font-bold text-white">Deposit Details</h2>
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
          ) : selectedDeposit ? (
            <>
              {/* Status */}
              <div className="flex items-center justify-between">
                {getStatusBadge(selectedDeposit.status)}
                <span className="text-slate-400 text-sm">
                  {formatDate(selectedDeposit.createdAt)}
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
                      {selectedDeposit.user.username
                        ? `@${selectedDeposit.user.username}`
                        : selectedDeposit.user.firstName || 'N/A'}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Telegram ID</p>
                    <p className="text-white font-mono">{selectedDeposit.user.telegramId}</p>
                  </div>
                  {'fortuneBalance' in selectedDeposit.user && (
                    <>
                      <div>
                        <p className="text-xs text-slate-500">Balance</p>
                        <p className="text-amber-400">${formatAmount(selectedDeposit.user.fortuneBalance)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-500">Max Tier</p>
                        <p className="text-white">{selectedDeposit.user.maxTierReached}</p>
                      </div>
                    </>
                  )}
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
                    <p className="text-xs text-slate-500">Currency</p>
                    <p className="text-lg">{getCurrencyLabel(selectedDeposit.currency)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Amount</p>
                    <p className="text-white text-lg font-medium">
                      {formatAmount(selectedDeposit.amount)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">USD Value</p>
                    <p className="text-amber-400 text-lg font-medium">
                      ${formatAmount(selectedDeposit.amountUsd)}
                    </p>
                  </div>
                  {selectedDeposit.rateToUsd && (
                    <div>
                      <p className="text-xs text-slate-500">Rate to USD</p>
                      <p className="text-white">${formatAmount(selectedDeposit.rateToUsd)}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-xs text-slate-500">Method</p>
                    <p className="text-white">{selectedDeposit.method}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Chain</p>
                    <p className="text-white uppercase">{selectedDeposit.chain}</p>
                  </div>
                </div>
              </div>

              {/* Other Crypto Details */}
              {selectedDeposit.method === 'other_crypto' && (
                <div className="bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/30 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-xl">🌐</span>
                    <h3 className="text-sm font-medium text-amber-200">Other Crypto Details</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-amber-200/60">Network</p>
                      <p className="text-white font-medium">{selectedDeposit.otherCryptoNetwork || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-200/60">Token</p>
                      <p className="text-white font-medium">{selectedDeposit.otherCryptoToken || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-amber-200/60">Claimed Amount</p>
                      <p className="text-amber-400 text-lg font-medium">
                        {selectedDeposit.claimedAmount ? formatAmount(selectedDeposit.claimedAmount) : 'N/A'}
                      </p>
                    </div>
                  </div>

                  {/* Rejection Reason */}
                  {selectedDeposit.status === 'rejected' && selectedDeposit.rejectionReason && (
                    <div className="mt-4 pt-4 border-t border-red-500/20">
                      <p className="text-xs text-red-400 mb-1">Rejection Reason</p>
                      <p className="text-white">{selectedDeposit.rejectionReason}</p>
                    </div>
                  )}

                  {/* Processing Info */}
                  {(selectedDeposit.processedBy || selectedDeposit.adminNotes) && (
                    <div className="mt-4 pt-4 border-t border-amber-500/20">
                      <div className="grid grid-cols-2 gap-4">
                        {selectedDeposit.processedBy && (
                          <div>
                            <p className="text-xs text-amber-200/60">Processed By</p>
                            <p className="text-white text-sm">{selectedDeposit.processedBy}</p>
                          </div>
                        )}
                        {selectedDeposit.processedAt && (
                          <div>
                            <p className="text-xs text-amber-200/60">Processed At</p>
                            <p className="text-white text-sm">{formatDate(selectedDeposit.processedAt)}</p>
                          </div>
                        )}
                      </div>
                      {selectedDeposit.adminNotes && (
                        <div className="mt-3">
                          <p className="text-xs text-amber-200/60 mb-1">Admin Notes</p>
                          <p className="text-white text-sm">{selectedDeposit.adminNotes}</p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Transaction Info */}
              <div className="bg-slate-800/50 rounded-lg p-4 space-y-3">
                <div>
                  <p className="text-xs text-slate-500 mb-1">Transaction Signature</p>
                  <div className="flex items-center gap-2">
                    <p className="text-white font-mono text-sm break-all flex-1">
                      {selectedDeposit.txSignature}
                    </p>
                    <a
                      href={`https://solscan.io/tx/${selectedDeposit.txSignature}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-amber-400 hover:text-amber-300"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                </div>

                {selectedDeposit.memo && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Memo</p>
                    <p className="text-white font-mono">{selectedDeposit.memo}</p>
                  </div>
                )}

                {selectedDeposit.slot && (
                  <div>
                    <p className="text-xs text-slate-500 mb-1">Slot</p>
                    <p className="text-white font-mono">{selectedDeposit.slot}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 pt-2">
                  <div>
                    <p className="text-xs text-slate-500">Confirmed At</p>
                    <p className="text-white text-sm">{formatDate(selectedDeposit.confirmedAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-500">Credited At</p>
                    <p className="text-white text-sm">{formatDate(selectedDeposit.creditedAt)}</p>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {selectedDeposit.errorMessage && (
                <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
                  <p className="text-xs text-red-400 mb-1">Error Message</p>
                  <p className="text-white">{selectedDeposit.errorMessage}</p>
                </div>
              )}

              {/* Action Buttons */}
              {/* Failed deposits - manual credit or retry */}
              {selectedDeposit.status === 'failed' && (
                <div className="border-t border-slate-700 pt-4">
                  {actionMode === 'none' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => setActionMode('credit')}
                        className="
                          flex-1 py-2.5 px-4 rounded-lg
                          bg-green-600 text-white font-medium
                          hover:bg-green-500 transition-colors
                          flex items-center justify-center gap-2
                        "
                      >
                        <CheckCircle className="w-4 h-4" />
                        Manual Credit
                      </button>
                      <button
                        onClick={handleRetry}
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
                            <RefreshCw className="w-4 h-4" />
                            Retry
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {actionMode === 'credit' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">
                          Reason for Manual Credit *
                        </label>
                        <textarea
                          value={reason}
                          onChange={(e) => setReason(e.target.value)}
                          placeholder="Enter reason for manual credit..."
                          rows={3}
                          className="
                            w-full px-4 py-2
                            bg-slate-800 border border-slate-700
                            rounded-lg text-white placeholder-slate-500
                            focus:outline-none focus:border-green-500
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
                          onClick={handleCredit}
                          disabled={isProcessing || !reason.trim()}
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
                            'Confirm Credit'
                          )}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Other Crypto pending - approve or reject */}
              {selectedDeposit.status === 'pending' && selectedDeposit.method === 'other_crypto' && (
                <div className="border-t border-amber-500/30 pt-4">
                  {actionMode === 'none' && (
                    <div className="flex gap-3">
                      <button
                        onClick={() => {
                          setActionMode('approve_other_crypto');
                          setActualAmount(selectedDeposit.claimedAmount?.toString() || '');
                        }}
                        className="
                          flex-1 py-2.5 px-4 rounded-lg
                          bg-green-600 text-white font-medium
                          hover:bg-green-500 transition-colors
                          flex items-center justify-center gap-2
                        "
                      >
                        <CheckCircle className="w-4 h-4" />
                        Approve
                      </button>
                      <button
                        onClick={() => setActionMode('reject_other_crypto')}
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

                  {actionMode === 'approve_other_crypto' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">
                          Actual Amount (USDT) *
                        </label>
                        <input
                          type="number"
                          step="any"
                          min="0"
                          value={actualAmount}
                          onChange={(e) => setActualAmount(e.target.value)}
                          placeholder="Enter actual amount received..."
                          className="
                            w-full px-4 py-2
                            bg-slate-800 border border-slate-700
                            rounded-lg text-white placeholder-slate-500
                            focus:outline-none focus:border-green-500
                          "
                        />
                        <p className="text-xs text-slate-500 mt-1">
                          User claimed: {selectedDeposit.claimedAmount ? formatAmount(selectedDeposit.claimedAmount) : 'N/A'} {selectedDeposit.otherCryptoToken}
                        </p>
                      </div>
                      <div>
                        <label className="block text-sm text-slate-400 mb-1">
                          Admin Notes (Optional)
                        </label>
                        <textarea
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Add any notes about this approval..."
                          rows={2}
                          className="
                            w-full px-4 py-2
                            bg-slate-800 border border-slate-700
                            rounded-lg text-white placeholder-slate-500
                            focus:outline-none focus:border-green-500
                            resize-none
                          "
                        />
                      </div>
                      <div className="flex gap-3">
                        <button
                          onClick={() => {
                            setActionMode('none');
                            setActualAmount('');
                            setNotes('');
                          }}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-slate-700 text-white font-medium
                            hover:bg-slate-600 transition-colors
                          "
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleApproveOtherCrypto}
                          disabled={isProcessing || !actualAmount || parseFloat(actualAmount) <= 0}
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
                            'Confirm Approval'
                          )}
                        </button>
                      </div>
                    </div>
                  )}

                  {actionMode === 'reject_other_crypto' && (
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
                          onClick={() => {
                            setActionMode('none');
                            setReason('');
                          }}
                          className="
                            flex-1 py-2.5 px-4 rounded-lg
                            bg-slate-700 text-white font-medium
                            hover:bg-slate-600 transition-colors
                          "
                        >
                          Cancel
                        </button>
                        <button
                          onClick={handleRejectOtherCrypto}
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
                            'Confirm Rejection'
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
              Deposit not found
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
