'use client';

import { useEffect, useState, useCallback } from 'react';
import {
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
  Filter,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { useAdminAuditStore } from '@/stores/admin/admin-audit.store';
import type { AdminAuditLogItem } from '@/lib/api';

export function AuditTable() {
  const {
    logs,
    stats,
    total,
    limit,
    offset,
    filters,
    isLoading,
    error,
    fetchLogs,
    fetchStats,
    setAction,
    setResource,
    setPage,
    resetFilters,
    clearError,
  } = useAdminAuditStore();

  const [showFilters, setShowFilters] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, [fetchLogs, fetchStats]);

  const handleActionFilter = useCallback((value: string) => {
    setAction(value || undefined);
    fetchLogs(true);
  }, [setAction, fetchLogs]);

  const handleResourceFilter = useCallback((value: string) => {
    setResource(value || undefined);
    fetchLogs(true);
  }, [setResource, fetchLogs]);

  const handleResetFilters = useCallback(() => {
    resetFilters();
    fetchLogs(true);
  }, [resetFilters, fetchLogs]);

  const currentPage = Math.floor(offset / limit);
  const totalPages = Math.ceil(total / limit);

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

  const getActionBadge = (action: string) => {
    const colors: Record<string, string> = {
      user_banned: 'bg-red-500/10 text-red-400',
      user_unbanned: 'bg-green-500/10 text-green-400',
      withdrawal_approved: 'bg-blue-500/10 text-blue-400',
      withdrawal_completed: 'bg-green-500/10 text-green-400',
      withdrawal_rejected: 'bg-red-500/10 text-red-400',
      deposit_manual_credit: 'bg-green-500/10 text-green-400',
      deposit_retry: 'bg-yellow-500/10 text-yellow-400',
      tier_created: 'bg-purple-500/10 text-purple-400',
      tier_updated: 'bg-blue-500/10 text-blue-400',
      tier_deleted: 'bg-red-500/10 text-red-400',
      settings_updated: 'bg-amber-500/10 text-amber-400',
      settings_reset: 'bg-orange-500/10 text-orange-400',
    };

    const colorClass = colors[action] || 'bg-slate-500/10 text-slate-400';

    return (
      <span className={`inline-flex px-2 py-1 rounded text-xs font-medium ${colorClass}`}>
        {action.replace(/_/g, ' ')}
      </span>
    );
  };

  const getResourceBadge = (resource: string) => {
    const colors: Record<string, string> = {
      user: 'text-purple-400',
      withdrawal: 'text-green-400',
      deposit: 'text-blue-400',
      tier: 'text-amber-400',
      settings: 'text-orange-400',
    };

    return (
      <span className={`${colors[resource] || 'text-slate-400'}`}>
        {resource}
      </span>
    );
  };

  const formatValue = (value: unknown): string => {
    if (value === null || value === undefined) return 'null';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const renderValueDiff = (oldValue: unknown, newValue: unknown) => {
    const oldFormatted = formatValue(oldValue);
    const newFormatted = formatValue(newValue);

    return (
      <div className="grid grid-cols-2 gap-4 mt-2">
        <div>
          <p className="text-xs text-slate-500 mb-1">Old Value</p>
          <pre className="text-xs text-red-400/80 bg-slate-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
            {oldFormatted}
          </pre>
        </div>
        <div>
          <p className="text-xs text-slate-500 mb-1">New Value</p>
          <pre className="text-xs text-green-400/80 bg-slate-800 p-2 rounded overflow-x-auto whitespace-pre-wrap">
            {newFormatted}
          </pre>
        </div>
      </div>
    );
  };

  if (isLoading && logs.length === 0) {
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
                Total: <span className="text-white font-medium">{stats.totalLogs}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Today: <span className="text-amber-400 font-medium">{stats.todayCount}</span>
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
              fetchLogs();
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

      {/* Filter row */}
      {showFilters && (
        <div className="flex flex-wrap items-center gap-4 p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Action:</label>
            <select
              value={filters.action || ''}
              onChange={(e) => handleActionFilter(e.target.value)}
              className="
                px-3 py-1.5 bg-slate-700 border border-slate-600
                rounded text-white text-sm
                focus:outline-none focus:border-amber-500
              "
            >
              <option value="">All</option>
              <option value="user_banned">User Banned</option>
              <option value="user_unbanned">User Unbanned</option>
              <option value="withdrawal_approved">Withdrawal Approved</option>
              <option value="withdrawal_completed">Withdrawal Completed</option>
              <option value="withdrawal_rejected">Withdrawal Rejected</option>
              <option value="deposit_manual_credit">Deposit Credit</option>
              <option value="tier_created">Tier Created</option>
              <option value="tier_updated">Tier Updated</option>
              <option value="settings_updated">Settings Updated</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <label className="text-sm text-slate-400">Resource:</label>
            <select
              value={filters.resource || ''}
              onChange={(e) => handleResourceFilter(e.target.value)}
              className="
                px-3 py-1.5 bg-slate-700 border border-slate-600
                rounded text-white text-sm
                focus:outline-none focus:border-amber-500
              "
            >
              <option value="">All</option>
              <option value="user">User</option>
              <option value="withdrawal">Withdrawal</option>
              <option value="deposit">Deposit</option>
              <option value="tier">Tier</option>
              <option value="settings">Settings</option>
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

      {/* Logs list */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 overflow-hidden">
        <div className="divide-y divide-slate-700">
          {logs.length === 0 ? (
            <div className="px-4 py-8 text-center text-slate-400">
              No audit logs found
            </div>
          ) : (
            logs.map((log: AdminAuditLogItem) => (
              <div
                key={log.id}
                className="hover:bg-slate-800/50 transition-colors"
              >
                <button
                  onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                  className="w-full px-4 py-4 flex items-center justify-between text-left"
                >
                  <div className="flex items-center gap-4 flex-wrap">
                    {getActionBadge(log.adminAction)}
                    <span className="text-slate-400">on</span>
                    {getResourceBadge(log.resource)}
                    {log.resourceId && (
                      <span className="text-slate-500 font-mono text-sm">
                        {log.resourceId.length > 20
                          ? `${log.resourceId.slice(0, 8)}...${log.resourceId.slice(-8)}`
                          : log.resourceId}
                      </span>
                    )}
                    {log.adminUser && (
                      <span className="text-xs text-slate-500">
                        by {log.adminUser}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400 text-sm">
                      {formatDate(log.createdAt)}
                    </span>
                    {expandedLogId === log.id ? (
                      <ChevronUp className="w-4 h-4 text-slate-400" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-slate-400" />
                    )}
                  </div>
                </button>

                {expandedLogId === log.id && (
                  <div className="px-4 pb-4">
                    {renderValueDiff(log.oldValue, log.newValue)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-slate-400">
            Showing {offset + 1}-{Math.min(offset + limit, total)} of {total} logs
          </p>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setPage(currentPage - 1);
                fetchLogs();
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
                fetchLogs();
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

      {/* Stats by action */}
      {stats && Object.keys(stats.byAction).length > 0 && (
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-4">
          <h3 className="text-sm font-medium text-slate-300 mb-3">Actions by Type</h3>
          <div className="flex flex-wrap gap-3">
            {Object.entries(stats.byAction).map(([action, count]) => (
              <div
                key={action}
                className="flex items-center gap-2 px-3 py-2 bg-slate-800 rounded-lg"
              >
                {getActionBadge(action)}
                <span className="text-white font-medium">{count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
