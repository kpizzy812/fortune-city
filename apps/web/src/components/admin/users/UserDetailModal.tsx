'use client';

import { useEffect, useState } from 'react';
import {
  X,
  Ban,
  CheckCircle,
  User,
  Wallet,
  Link2,
  AlertTriangle,
  Network,
  Copy,
  Check,
  Settings,
} from 'lucide-react';
import { useAdminUsersStore } from '@/stores/admin/admin-users.store';
import { ReferralTree } from './ReferralTree';
import { ManageUserActions } from './ManageUserActions';

interface UserDetailModalProps {
  userId: string;
  onClose: () => void;
}

type Tab = 'info' | 'referrals' | 'management';

export function UserDetailModal({ userId, onClose }: UserDetailModalProps) {
  const {
    selectedUser,
    isLoadingUser,
    error,
    fetchUser,
    banUser,
    unbanUser,
    clearSelectedUser,
    clearError,
  } = useAdminUsersStore();

  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [banReason, setBanReason] = useState('');
  const [showBanConfirm, setShowBanConfirm] = useState(false);
  const [showUnbanConfirm, setShowUnbanConfirm] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    fetchUser(userId);
    return () => {
      clearSelectedUser();
      clearError();
    };
  }, [userId, fetchUser, clearSelectedUser, clearError]);

  const handleBan = async () => {
    if (!banReason.trim()) return;
    setActionLoading(true);
    try {
      await banUser(userId, banReason);
      setShowBanConfirm(false);
      setBanReason('');
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnban = async () => {
    setActionLoading(true);
    try {
      await unbanUser(userId);
      setShowUnbanConfirm(false);
    } finally {
      setActionLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatBalance = (balance: number) => {
    return balance.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
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
    });
  };

  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(0)}%`;
  };

  const getUserDisplayName = () => {
    if (!selectedUser) return '';
    if (selectedUser.username) return `@${selectedUser.username}`;
    if (selectedUser.firstName) {
      return selectedUser.lastName
        ? `${selectedUser.firstName} ${selectedUser.lastName}`
        : selectedUser.firstName;
    }
    if (selectedUser.email) return selectedUser.email;
    if (selectedUser.web3Address) return `${selectedUser.web3Address.slice(0, 4)}...${selectedUser.web3Address.slice(-4)}`;
    if (selectedUser.telegramId) return `TG: ${selectedUser.telegramId}`;
    return `ID: ${selectedUser.id.slice(0, 8)}`;
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-slate-900 rounded-2xl border border-slate-700 w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-700">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-slate-700 flex items-center justify-center">
              <User className="w-6 h-6 text-slate-400" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-white">
                {isLoadingUser ? 'Loading...' : getUserDisplayName()}
              </h2>
              {selectedUser && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-slate-400">
                    {selectedUser.referralCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(selectedUser.referralCode)}
                    className="text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-400" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-lg bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-slate-700">
          <button
            onClick={() => setActiveTab('info')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium
              transition-colors
              ${activeTab === 'info'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            User Info
          </button>
          <button
            onClick={() => setActiveTab('referrals')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium
              transition-colors
              ${activeTab === 'referrals'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <Network className="w-4 h-4 inline mr-2" />
            Referral Tree
          </button>
          <button
            onClick={() => setActiveTab('management')}
            className={`
              flex-1 px-4 py-3 text-sm font-medium
              transition-colors
              ${activeTab === 'management'
                ? 'text-amber-400 border-b-2 border-amber-400'
                : 'text-slate-400 hover:text-white'
              }
            `}
          >
            <Settings className="w-4 h-4 inline mr-2" />
            Management
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {isLoadingUser ? (
            <div className="flex items-center justify-center h-64">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-64">
              <div className="text-center">
                <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
                <p className="text-red-400">{error}</p>
              </div>
            </div>
          ) : selectedUser && activeTab === 'info' ? (
            <div className="space-y-6">
              {/* Ban Status */}
              {selectedUser.isBanned && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <Ban className="w-5 h-5 text-red-400 mt-0.5" />
                    <div>
                      <p className="text-red-400 font-medium">User is banned</p>
                      {selectedUser.bannedReason && (
                        <p className="text-red-300/80 text-sm mt-1">
                          Reason: {selectedUser.bannedReason}
                        </p>
                      )}
                      <p className="text-red-300/60 text-xs mt-1">
                        Banned at: {formatDate(selectedUser.bannedAt)}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Balance Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Wallet className="w-4 h-4" />
                    <span className="text-xs uppercase">Fortune Balance</span>
                  </div>
                  <p className="text-2xl font-bold text-amber-400">
                    ${formatBalance(selectedUser.fortuneBalance)}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="flex items-center gap-2 text-slate-400 mb-2">
                    <Link2 className="w-4 h-4" />
                    <span className="text-xs uppercase">Referral Balance</span>
                  </div>
                  <p className="text-2xl font-bold text-green-400">
                    ${formatBalance(selectedUser.referralBalance)}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="text-slate-400 text-xs uppercase mb-2">Max Tier</div>
                  <p className="text-2xl font-bold text-white">
                    {selectedUser.maxTierReached}
                  </p>
                </div>

                <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700">
                  <div className="text-slate-400 text-xs uppercase mb-2">Tax Rate</div>
                  <p className="text-2xl font-bold text-white">
                    {formatPercent(selectedUser.currentTaxRate)}
                  </p>
                </div>
              </div>

              {/* Statistics */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Statistics</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div>
                    <p className="text-sm text-slate-400">Total Deposits</p>
                    <p className="text-lg font-semibold text-white">
                      {selectedUser.stats.totalDeposits}
                    </p>
                    <p className="text-sm text-green-400">
                      ${formatBalance(selectedUser.stats.totalDepositsAmount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Total Withdrawals</p>
                    <p className="text-lg font-semibold text-white">
                      {selectedUser.stats.totalWithdrawals}
                    </p>
                    <p className="text-sm text-red-400">
                      ${formatBalance(selectedUser.stats.totalWithdrawalsAmount)}
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Machines Purchased</p>
                    <p className="text-lg font-semibold text-white">
                      {selectedUser.stats.totalMachinesPurchased}
                    </p>
                    <p className="text-sm text-slate-400">
                      {selectedUser.stats.activeMachines} active
                    </p>
                  </div>

                  <div>
                    <p className="text-sm text-slate-400">Referral Earnings</p>
                    <p className="text-lg font-semibold text-amber-400">
                      ${formatBalance(selectedUser.stats.totalReferralEarnings)}
                    </p>
                    <p className="text-sm text-slate-400">
                      {selectedUser.referralsCount} referrals
                    </p>
                  </div>
                </div>
              </div>

              {/* Details */}
              <div className="bg-slate-800/50 rounded-xl p-6 border border-slate-700">
                <h3 className="text-lg font-semibold text-white mb-4">Details</h3>
                <div className="grid grid-cols-2 gap-4">
                  {selectedUser.telegramId && (
                    <div>
                      <p className="text-sm text-slate-400">Telegram ID</p>
                      <p className="text-white">{selectedUser.telegramId}</p>
                    </div>
                  )}
                  {selectedUser.email && (
                    <div>
                      <p className="text-sm text-slate-400">Email</p>
                      <p className="text-white text-sm break-all">{selectedUser.email}</p>
                    </div>
                  )}
                  {selectedUser.web3Address && (
                    <div className="col-span-2">
                      <p className="text-sm text-slate-400">Web3 Address</p>
                      <p className="text-white text-sm font-mono break-all">{selectedUser.web3Address}</p>
                    </div>
                  )}
                  <div>
                    <p className="text-sm text-slate-400">Joined</p>
                    <p className="text-white">{formatDate(selectedUser.createdAt)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Fresh Deposits</p>
                    <p className="text-white">${formatBalance(selectedUser.totalFreshDeposits)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Profit Collected</p>
                    <p className="text-white">${formatBalance(selectedUser.totalProfitCollected)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Referrer</p>
                    <p className="text-white">
                      {selectedUser.referrer
                        ? selectedUser.referrer.username
                          ? `@${selectedUser.referrer.username}`
                          : selectedUser.referrer.telegramId
                            ? `TG: ${selectedUser.referrer.telegramId}`
                            : `ID: ${selectedUser.referrer.id}`
                        : 'None'
                      }
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-slate-400">Free Spins</p>
                    <p className="text-white">{selectedUser.freeSpinsRemaining}</p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                {selectedUser.isBanned ? (
                  <button
                    onClick={() => setShowUnbanConfirm(true)}
                    disabled={actionLoading}
                    className="
                      flex items-center gap-2 px-6 py-2
                      bg-green-600 text-white
                      rounded-lg font-medium
                      hover:bg-green-500
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                    "
                  >
                    <CheckCircle className="w-4 h-4" />
                    Unban User
                  </button>
                ) : (
                  <button
                    onClick={() => setShowBanConfirm(true)}
                    disabled={actionLoading}
                    className="
                      flex items-center gap-2 px-6 py-2
                      bg-red-600 text-white
                      rounded-lg font-medium
                      hover:bg-red-500
                      disabled:opacity-50 disabled:cursor-not-allowed
                      transition-colors
                    "
                  >
                    <Ban className="w-4 h-4" />
                    Ban User
                  </button>
                )}
              </div>

              {/* Ban Confirmation */}
              {showBanConfirm && (
                <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4">
                  <h4 className="text-red-400 font-medium mb-3">Confirm Ban</h4>
                  <textarea
                    value={banReason}
                    onChange={(e) => setBanReason(e.target.value)}
                    placeholder="Enter ban reason..."
                    className="
                      w-full px-4 py-3
                      bg-slate-800 border border-slate-600
                      rounded-lg text-white placeholder-slate-500
                      focus:outline-none focus:border-red-500
                      resize-none
                    "
                    rows={3}
                  />
                  <div className="flex justify-end gap-3 mt-3">
                    <button
                      onClick={() => {
                        setShowBanConfirm(false);
                        setBanReason('');
                      }}
                      className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleBan}
                      disabled={!banReason.trim() || actionLoading}
                      className="
                        px-4 py-2 bg-red-600 text-white
                        rounded-lg hover:bg-red-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors
                      "
                    >
                      {actionLoading ? 'Banning...' : 'Confirm Ban'}
                    </button>
                  </div>
                </div>
              )}

              {/* Unban Confirmation */}
              {showUnbanConfirm && (
                <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4">
                  <h4 className="text-green-400 font-medium mb-3">Confirm Unban</h4>
                  <p className="text-slate-300 mb-4">
                    Are you sure you want to unban this user?
                  </p>
                  <div className="flex justify-end gap-3">
                    <button
                      onClick={() => setShowUnbanConfirm(false)}
                      className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleUnban}
                      disabled={actionLoading}
                      className="
                        px-4 py-2 bg-green-600 text-white
                        rounded-lg hover:bg-green-500
                        disabled:opacity-50 disabled:cursor-not-allowed
                        transition-colors
                      "
                    >
                      {actionLoading ? 'Unbanning...' : 'Confirm Unban'}
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : activeTab === 'referrals' ? (
            <ReferralTree userId={userId} />
          ) : activeTab === 'management' && selectedUser ? (
            <ManageUserActions user={selectedUser} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
