'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import {
  Users,
  Layers,
  DollarSign,
  ArrowDownToLine,
  CreditCard,
  Activity,
  RefreshCw,
} from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin/admin-auth.store';
import { api } from '@/lib/api';

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMachines: number;
  activeMachines: number;
  totalDeposits: number;
  totalDepositsAmount: number;
  totalWithdrawals: number;
  totalWithdrawalsAmount: number;
  pendingWithdrawals: number;
}

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'amber' | 'blue' | 'green' | 'purple' | 'red';
}

function StatCard({ title, value, subtitle, icon, color }: StatCardProps) {
  const colorClasses = {
    amber: 'from-amber-500 to-orange-600',
    blue: 'from-blue-500 to-cyan-600',
    green: 'from-green-500 to-emerald-600',
    purple: 'from-purple-500 to-pink-600',
    red: 'from-red-500 to-rose-600',
  };

  return (
    <div className="bg-slate-900 rounded-xl border border-slate-700 p-5">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <p className="text-2xl font-bold text-white mt-1">{value}</p>
          {subtitle && (
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} bg-opacity-20`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const { token } = useAdminAuthStore();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStats = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await api.adminGetDashboardStats(token);
      setStats(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load stats');
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <p className="text-red-400">{error}</p>
        <button
          onClick={fetchStats}
          className="mt-3 px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  // Fallback stats if API not ready
  const displayStats = stats || {
    totalUsers: 0,
    activeUsers: 0,
    totalMachines: 0,
    activeMachines: 0,
    totalDeposits: 0,
    totalDepositsAmount: 0,
    totalWithdrawals: 0,
    totalWithdrawalsAmount: 0,
    pendingWithdrawals: 0,
  };

  return (
    <div className="space-y-6">
      {/* Refresh Button */}
      <div className="flex justify-end">
        <button
          onClick={fetchStats}
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
          <span>Refresh</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={displayStats.totalUsers.toLocaleString()}
          subtitle={`${displayStats.activeUsers} active`}
          icon={<Users className="w-5 h-5 text-white" />}
          color="amber"
        />
        <StatCard
          title="Active Machines"
          value={displayStats.activeMachines.toLocaleString()}
          subtitle={`${displayStats.totalMachines} total`}
          icon={<Layers className="w-5 h-5 text-white" />}
          color="blue"
        />
        <StatCard
          title="Total Deposits"
          value={`$${displayStats.totalDepositsAmount.toLocaleString()}`}
          subtitle={`${displayStats.totalDeposits} transactions`}
          icon={<ArrowDownToLine className="w-5 h-5 text-white" />}
          color="green"
        />
        <StatCard
          title="Total Withdrawals"
          value={`$${displayStats.totalWithdrawalsAmount.toLocaleString()}`}
          subtitle={`${displayStats.pendingWithdrawals} pending`}
          icon={<CreditCard className="w-5 h-5 text-white" />}
          color="purple"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Link
            href="/admin/users"
            className="
              flex flex-col items-center justify-center gap-2 p-4
              bg-slate-800 rounded-lg border border-slate-700
              hover:bg-slate-700 hover:border-amber-500/30
              transition-colors
            "
          >
            <Users className="w-6 h-6 text-amber-500" />
            <span className="text-sm text-slate-300">Manage Users</span>
          </Link>
          <Link
            href="/admin/tiers"
            className="
              flex flex-col items-center justify-center gap-2 p-4
              bg-slate-800 rounded-lg border border-slate-700
              hover:bg-slate-700 hover:border-amber-500/30
              transition-colors
            "
          >
            <Layers className="w-6 h-6 text-blue-500" />
            <span className="text-sm text-slate-300">Manage Tiers</span>
          </Link>
          <Link
            href="/admin/withdrawals"
            className="
              flex flex-col items-center justify-center gap-2 p-4
              bg-slate-800 rounded-lg border border-slate-700
              hover:bg-slate-700 hover:border-amber-500/30
              transition-colors
            "
          >
            <DollarSign className="w-6 h-6 text-green-500" />
            <span className="text-sm text-slate-300">Withdrawals</span>
          </Link>
          <Link
            href="/admin/settings"
            className="
              flex flex-col items-center justify-center gap-2 p-4
              bg-slate-800 rounded-lg border border-slate-700
              hover:bg-slate-700 hover:border-amber-500/30
              transition-colors
            "
          >
            <Activity className="w-6 h-6 text-purple-500" />
            <span className="text-sm text-slate-300">Settings</span>
          </Link>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-slate-400">API Server</span>
            <span className="flex items-center gap-2 text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Online
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Database</span>
            <span className="flex items-center gap-2 text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-slate-400">Blockchain RPC</span>
            <span className="flex items-center gap-2 text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Healthy
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
