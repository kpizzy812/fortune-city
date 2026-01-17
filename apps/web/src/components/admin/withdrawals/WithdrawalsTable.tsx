'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Clock,
  CheckCircle,
  XCircle,
  Loader2,
  Eye,
  ArrowUpDown,
  Filter,
  X,
} from 'lucide-react';
import { useAdminWithdrawalsStore } from '@/stores/admin/admin-withdrawals.store';
import type { AdminWithdrawalListItem, WithdrawalSortField, WithdrawalStatusFilter } from '@/lib/api';

interface WithdrawalsTableProps {
  onViewWithdrawal: (id: string) => void;
}

export function WithdrawalsTable({ onViewWithdrawal }: WithdrawalsTableProps) {
  const {
    withdrawals,
    stats,
    total,
    limit,
    offset,
    filters,
    isLoading,
    error,
    fetchWithdrawals,
    fetchStats,
    setSearch,
    setStatus,
    setSortBy,
    setSortOrder,
    setPage,
    resetFilters,
    clearError,
  } = useAdminWithdrawalsStore();

  const [searchInput, setSearchInput] = useState(filters.search || '');
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchWithdrawals();
    fetchStats();
  }, [fetchWithdrawals, fetchStats]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== filters.search) {
        setSearch(searchInput);
        fetchWithdrawals(true);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput, filters.search, setSearch, fetchWithdrawals]);

  const handleSort = useCallback((field: WithdrawalSortField) => {
    if (filters.sortBy === field) {
      setSortOrder(filters.sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
    fetchWithdrawals(true);
  }, [filters.sortBy, filters.sortOrder, setSortBy, setSortOrder, fetchWithdrawals]);

  const handleStatusFilter = useCallback((value: WithdrawalStatusFilter) => {
    setStatus(value);
    fetchWithdrawals(true);
  }, [setStatus, fetchWithdrawals]);

  const handleResetFilters = useCallback(() => {
    setSearchInput('');
    resetFilters();
    fetchWithdrawals(true);
  }, [resetFilters, fetchWithdrawals]);

  const currentPage = Math.floor(offset / limit);
  const totalPages = Math.ceil(total / limit);

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const truncateAddress = (address: string) => {
    if (address.length <= 16) return address;
    return `${address.slice(0, 8)}...${address.slice(-8)}`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-400 rounded text-xs font-medium">
            <Clock className="w-3 h-3" />
            Pending
          </span>
        );
      case 'processing':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-blue-500/10 text-blue-400 rounded text-xs font-medium">
            <Loader2 className="w-3 h-3 animate-spin" />
            Processing
          </span>
        );
      case 'completed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-500/10 text-green-400 rounded text-xs font-medium">
            <CheckCircle className="w-3 h-3" />
            Completed
          </span>
        );
      case 'failed':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-red-500/10 text-red-400 rounded text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Failed
          </span>
        );
      case 'cancelled':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/10 text-slate-400 rounded text-xs font-medium">
            <XCircle className="w-3 h-3" />
            Cancelled
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-slate-500/10 text-slate-400 rounded text-xs font-medium">
            {status}
          </span>
        );
    }
  };

  const getUserDisplayName = (withdrawal: AdminWithdrawalListItem) => {
    if (withdrawal.user.username) return `@${withdrawal.user.username}`;
    if (withdrawal.user.firstName) return withdrawal.user.firstName;
    return `ID: ${withdrawal.user.telegramId}`;
  };

  const renderSortButton = (field: WithdrawalSortField, label: string) => (
    <button
      onClick={() => handleSort(field)}
      className="flex items-center gap-1 hover:text-white transition-colors"
    >
      {label}
      <ArrowUpDown
        className={`w-3 h-3 ${filters.sortBy === field ? 'text-amber-400' : ''}`}
      />
    </button>
  );

  if (isLoading && withdrawals.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          {stats && (
            <div className="flex items-center gap-3 text-sm flex-wrap">
              <span className="text-slate-400">
                Total: <span className="text-white font-medium">{stats.totalWithdrawals}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Pending: <span className="text-yellow-400 font-medium">{stats.pendingCount}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Processing: <span className="text-blue-400 font-medium">{stats.processingCount}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Completed: <span className="text-green-400 font-medium">{stats.completedCount}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              flex items-center gap-2 px-4 py-2
              rounded-lg border transition-colors
              ${showFilters
                ? 'bg-amber-600/20 text-amber-400 border-amber-600'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }
            `}
          >
            <Filter className="w-4 h-4" />
            <span className="hidden sm:inline">Filters</span>
          </button>

          <button
            onClick={() => {
              fetchWithdrawals();
              fetchStats();
            }}
            disabled={isLoading}
            className="
              flex items-center gap-2 px-4 py-2
              bg-slate-800 text-slate-300
              rounded-lg border border-slate-700
              hover:bg-slate-700 hover:text-white
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-colors
            "
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="space-y-4">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by wallet address, tx signature, user..."
            className="
              w-full pl-10 pr-4 py-3
              bg-slate-800 border border-slate-700
              rounded-lg text-white placeholder-slate-500
              focus:outline-none focus:border-amber-500
              transition-colors
            "
          />
          {searchInput && (
            <button
              onClick={() => setSearchInput('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Filter row */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <div className="flex items-center gap-2">
              <label className="text-sm text-slate-400">Status:</label>
              <select
                value={filters.status || 'all'}
                onChange={(e) => handleStatusFilter(e.target.value as WithdrawalStatusFilter)}
                className="
                  px-3 py-1.5 bg-slate-700 border border-slate-600
                  rounded text-white text-sm
                  focus:outline-none focus:border-amber-500
                "
              >
                <option value="all">All</option>
                <option value="pending">Pending</option>
                <option value="processing">Processing</option>
                <option value="completed">Completed</option>
                <option value="failed">Failed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </div>

            <button
              onClick={handleResetFilters}
              className="
                px-3 py-1.5 text-sm
                text-slate-400 hover:text-white
                transition-colors
              "
            >
              Reset filters
            </button>
          </div>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-400" />
            <p className="text-red-400">{error}</p>
          </div>
          <button
            onClick={clearError}
            className="text-red-400 hover:text-red-300"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Table */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-800/50 border-b border-slate-700">
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  User
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {renderSortButton('requestedAmount', 'Requested')}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {renderSortButton('netAmount', 'Net')}
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Wallet
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  {renderSortButton('createdAt', 'Date')}
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {withdrawals.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-slate-400">
                    No withdrawals found
                  </td>
                </tr>
              ) : (
                withdrawals.map((withdrawal) => (
                  <tr
                    key={withdrawal.id}
                    className="hover:bg-slate-800/50 transition-colors cursor-pointer"
                    onClick={() => onViewWithdrawal(withdrawal.id)}
                  >
                    <td className="px-4 py-4">
                      <div className="flex flex-col">
                        <span className="text-white font-medium">
                          {getUserDisplayName(withdrawal)}
                        </span>
                        <span className="text-xs text-slate-500">
                          {withdrawal.method}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-amber-400 font-medium">
                        ${formatAmount(withdrawal.requestedAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <div className="flex flex-col items-end">
                        <span className="text-green-400 font-medium">
                          ${formatAmount(withdrawal.netAmount)}
                        </span>
                        {withdrawal.taxAmount > 0 && (
                          <span className="text-xs text-slate-500">
                            Tax: ${formatAmount(withdrawal.taxAmount)}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-slate-300 font-mono text-sm">
                        {truncateAddress(withdrawal.walletAddress)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      {getStatusBadge(withdrawal.status)}
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-slate-400 text-sm">
                        {formatDate(withdrawal.createdAt)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onViewWithdrawal(withdrawal.id);
                        }}
                        className="
                          p-2 rounded-lg
                          bg-slate-800 text-slate-300
                          hover:bg-slate-700 hover:text-white
                          transition-colors
                        "
                        title="View details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} withdrawals
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPage(currentPage - 1);
                fetchWithdrawals();
              }}
              disabled={currentPage === 0 || isLoading}
              className="
                p-2 rounded-lg
                bg-slate-800 text-slate-300
                border border-slate-700
                hover:bg-slate-700 hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <ChevronLeft className="w-5 h-5" />
            </button>

            <span className="text-sm text-slate-400 px-3">
              Page {currentPage + 1} of {totalPages}
            </span>

            <button
              onClick={() => {
                setPage(currentPage + 1);
                fetchWithdrawals();
              }}
              disabled={currentPage >= totalPages - 1 || isLoading}
              className="
                p-2 rounded-lg
                bg-slate-800 text-slate-300
                border border-slate-700
                hover:bg-slate-700 hover:text-white
                disabled:opacity-50 disabled:cursor-not-allowed
                transition-colors
              "
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
