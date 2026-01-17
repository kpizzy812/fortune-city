'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Pencil,
  Trash2,
  Eye,
  EyeOff,
  Globe,
  Lock,
  Plus,
  RefreshCw,
  AlertCircle,
} from 'lucide-react';
import { useAdminTiersStore } from '@/stores/admin/admin-tiers.store';
import type { AdminTierResponse } from '@/lib/api';

interface TiersTableProps {
  showActions?: boolean;
}

export function TiersTable({ showActions = true }: TiersTableProps) {
  const {
    tiers,
    stats,
    isLoading,
    error,
    fetchTiers,
    fetchStats,
    toggleVisibility,
    toggleAvailability,
    deleteTier,
    clearError,
  } = useAdminTiersStore();

  const [deleteConfirm, setDeleteConfirm] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);

  useEffect(() => {
    fetchTiers();
    fetchStats();
  }, [fetchTiers, fetchStats]);

  const handleToggleVisibility = async (tier: number) => {
    setActionLoading(tier);
    await toggleVisibility(tier);
    setActionLoading(null);
  };

  const handleToggleAvailability = async (tier: number) => {
    setActionLoading(tier);
    await toggleAvailability(tier);
    setActionLoading(null);
  };

  const handleDelete = async (tier: number) => {
    if (deleteConfirm !== tier) {
      setDeleteConfirm(tier);
      return;
    }

    setActionLoading(tier);
    try {
      await deleteTier(tier);
    } finally {
      setDeleteConfirm(null);
      setActionLoading(null);
    }
  };

  const formatPrice = (price: number) => {
    return price.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });
  };

  const calculateDailyYield = (tier: AdminTierResponse) => {
    const totalYield = tier.price * (tier.yieldPercent / 100);
    const dailyYield = totalYield / tier.lifespanDays;
    return dailyYield.toFixed(2);
  };

  if (isLoading && tiers.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with stats and actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          {stats && (
            <div className="flex items-center gap-3 text-sm">
              <span className="text-slate-400">
                Total: <span className="text-white font-medium">{stats.total}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Visible: <span className="text-green-400 font-medium">{stats.visible}</span>
              </span>
              <span className="text-slate-600">|</span>
              <span className="text-slate-400">
                Hidden: <span className="text-red-400 font-medium">{stats.hidden}</span>
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchTiers();
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

          <Link
            href="/admin/tiers/new"
            className="
              flex items-center gap-2 px-4 py-2
              bg-amber-600 text-white
              rounded-lg
              hover:bg-amber-500
              transition-colors
            "
          >
            <Plus className="w-4 h-4" />
            <span>New Tier</span>
          </Link>
        </div>
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
                  Tier
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Name
                </th>
                <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Price
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Lifespan
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Yield
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Daily
                </th>
                <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                  Status
                </th>
                {showActions && (
                  <th className="text-right px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {tiers.length === 0 ? (
                <tr>
                  <td
                    colSpan={showActions ? 8 : 7}
                    className="px-4 py-8 text-center text-slate-400"
                  >
                    No tiers found. Create your first tier to get started.
                  </td>
                </tr>
              ) : (
                tiers.map((tier) => (
                  <tr
                    key={tier.id}
                    className={`
                      hover:bg-slate-800/50 transition-colors
                      ${!tier.isVisible ? 'opacity-50' : ''}
                    `}
                  >
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{tier.emoji}</span>
                        <span className="text-white font-medium">#{tier.tier}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="text-white">{tier.name}</span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-amber-400 font-medium">
                        ${formatPrice(tier.price)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-slate-300">{tier.lifespanDays}d</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-green-400">{tier.yieldPercent}%</span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-blue-400">
                        ${calculateDailyYield(tier)}/d
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => handleToggleVisibility(tier.tier)}
                          disabled={actionLoading === tier.tier}
                          className={`
                            p-1.5 rounded-lg transition-colors
                            ${tier.isVisible
                              ? 'bg-green-500/10 text-green-400 hover:bg-green-500/20'
                              : 'bg-red-500/10 text-red-400 hover:bg-red-500/20'
                            }
                            disabled:opacity-50
                          `}
                          title={tier.isVisible ? 'Visible in shop' : 'Hidden from shop'}
                        >
                          {tier.isVisible ? (
                            <Eye className="w-4 h-4" />
                          ) : (
                            <EyeOff className="w-4 h-4" />
                          )}
                        </button>
                        <button
                          onClick={() => handleToggleAvailability(tier.tier)}
                          disabled={actionLoading === tier.tier}
                          className={`
                            p-1.5 rounded-lg transition-colors
                            ${tier.isPubliclyAvailable
                              ? 'bg-blue-500/10 text-blue-400 hover:bg-blue-500/20'
                              : 'bg-slate-500/10 text-slate-400 hover:bg-slate-500/20'
                            }
                            disabled:opacity-50
                          `}
                          title={
                            tier.isPubliclyAvailable
                              ? 'Publicly available'
                              : 'Requires progression'
                          }
                        >
                          {tier.isPubliclyAvailable ? (
                            <Globe className="w-4 h-4" />
                          ) : (
                            <Lock className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </td>
                    {showActions && (
                      <td className="px-4 py-4">
                        <div className="flex items-center justify-end gap-2">
                          <Link
                            href={`/admin/tiers/${tier.tier}`}
                            className="
                              p-2 rounded-lg
                              bg-slate-800 text-slate-300
                              hover:bg-slate-700 hover:text-white
                              transition-colors
                            "
                            title="Edit tier"
                          >
                            <Pencil className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(tier.tier)}
                            disabled={actionLoading === tier.tier}
                            className={`
                              p-2 rounded-lg transition-colors
                              ${deleteConfirm === tier.tier
                                ? 'bg-red-600 text-white hover:bg-red-500'
                                : 'bg-slate-800 text-slate-300 hover:bg-red-500/20 hover:text-red-400'
                              }
                              disabled:opacity-50
                            `}
                            title={
                              deleteConfirm === tier.tier
                                ? 'Click again to confirm'
                                : 'Delete tier'
                            }
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
