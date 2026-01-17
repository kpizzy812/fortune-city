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
  TrendingUp,
  Wallet,
  Calendar,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { useAdminAuthStore } from '@/stores/admin/admin-auth.store';
import { api, type AdminDashboardStats, type DashboardChartData, type TierDistribution } from '@/lib/api';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  color: 'amber' | 'blue' | 'green' | 'purple' | 'red' | 'cyan';
}

function StatCard({ title, value, subtitle, icon, trend, color }: StatCardProps) {
  const colorClasses = {
    amber: 'from-amber-500 to-orange-600',
    blue: 'from-blue-500 to-cyan-600',
    green: 'from-green-500 to-emerald-600',
    purple: 'from-purple-500 to-pink-600',
    red: 'from-red-500 to-rose-600',
    cyan: 'from-cyan-500 to-blue-600',
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
          {trend && (
            <p className={`text-xs mt-1 flex items-center gap-1 ${trend.isPositive ? 'text-green-400' : 'text-red-400'}`}>
              <TrendingUp className={`w-3 h-3 ${!trend.isPositive ? 'rotate-180' : ''}`} />
              {trend.isPositive ? '+' : ''}{trend.value}% today
            </p>
          )}
        </div>
        <div className={`p-3 rounded-lg bg-gradient-to-br ${colorClasses[color]} bg-opacity-20`}>
          {icon}
        </div>
      </div>
    </div>
  );
}

const TIER_COLORS = [
  '#f59e0b', // Tier 1 - Amber
  '#3b82f6', // Tier 2 - Blue
  '#10b981', // Tier 3 - Green
  '#8b5cf6', // Tier 4 - Purple
  '#ef4444', // Tier 5 - Red
  '#ec4899', // Tier 6 - Pink
  '#14b8a6', // Tier 7 - Teal
  '#f97316', // Tier 8 - Orange
];

export default function AdminDashboardPage() {
  const { token } = useAdminAuthStore();
  const [stats, setStats] = useState<AdminDashboardStats | null>(null);
  const [chartData, setChartData] = useState<DashboardChartData | null>(null);
  const [tierDistribution, setTierDistribution] = useState<TierDistribution[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [chartDays, setChartDays] = useState(30);

  const fetchData = useCallback(async () => {
    if (!token) return;

    setIsLoading(true);
    setError(null);

    try {
      const [statsData, charts, tiers] = await Promise.all([
        api.adminGetDashboardStats(token),
        api.adminGetChartData(token, chartDays),
        api.adminGetTierDistribution(token),
      ]);
      setStats(statsData);
      setChartData(charts);
      setTierDistribution(tiers);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load data');
    } finally {
      setIsLoading(false);
    }
  }, [token, chartDays]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const formatCurrency = (value: number) => {
    if (value >= 1000000) return `$${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
    return `$${value.toFixed(2)}`;
  };

  const formatNumber = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}K`;
    return value.toString();
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  if (isLoading && !stats) {
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
          onClick={fetchData}
          className="mt-3 px-4 py-2 text-sm bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const displayStats = stats || {
    totalUsers: 0,
    activeUsers: 0,
    newUsersToday: 0,
    newUsersWeek: 0,
    totalMachines: 0,
    activeMachines: 0,
    totalDeposits: 0,
    totalDepositsAmount: 0,
    depositsToday: 0,
    depositsAmountToday: 0,
    totalWithdrawals: 0,
    totalWithdrawalsAmount: 0,
    pendingWithdrawals: 0,
    withdrawalsToday: 0,
    withdrawalsAmountToday: 0,
    totalFortuneBalance: 0,
    totalTaxCollected: 0,
  };

  // Prepare combined chart for deposits vs withdrawals
  const combinedFinanceData = chartData?.depositsChart.map((d, i) => ({
    date: d.date,
    deposits: d.value,
    withdrawals: chartData.withdrawalsChart[i]?.value || 0,
  })) || [];

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-sm text-slate-400">Overview of your platform metrics</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={chartDays}
            onChange={(e) => setChartDays(Number(e.target.value))}
            className="px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value={7}>Last 7 days</option>
            <option value={14}>Last 14 days</option>
            <option value={30}>Last 30 days</option>
            <option value={60}>Last 60 days</option>
            <option value={90}>Last 90 days</option>
          </select>
          <button
            onClick={fetchData}
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
      </div>

      {/* Key Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <StatCard
          title="Total Users"
          value={formatNumber(displayStats.totalUsers)}
          subtitle={`${displayStats.activeUsers} active · ${displayStats.newUsersToday} today`}
          icon={<Users className="w-5 h-5 text-white" />}
          color="amber"
        />
        <StatCard
          title="Active Machines"
          value={formatNumber(displayStats.activeMachines)}
          subtitle={`${displayStats.totalMachines} total`}
          icon={<Layers className="w-5 h-5 text-white" />}
          color="blue"
        />
        <StatCard
          title="Total Deposits"
          value={formatCurrency(displayStats.totalDepositsAmount)}
          subtitle={`${displayStats.totalDeposits} tx · $${displayStats.depositsAmountToday.toFixed(2)} today`}
          icon={<ArrowDownToLine className="w-5 h-5 text-white" />}
          color="green"
        />
        <StatCard
          title="Total Withdrawals"
          value={formatCurrency(displayStats.totalWithdrawalsAmount)}
          subtitle={`${displayStats.pendingWithdrawals} pending · $${displayStats.withdrawalsAmountToday.toFixed(2)} today`}
          icon={<CreditCard className="w-5 h-5 text-white" />}
          color="purple"
        />
      </div>

      {/* Secondary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          title="Total Fortune Balance"
          value={formatNumber(displayStats.totalFortuneBalance)}
          subtitle="Held by all users"
          icon={<Wallet className="w-5 h-5 text-white" />}
          color="cyan"
        />
        <StatCard
          title="Tax Collected"
          value={formatCurrency(displayStats.totalTaxCollected)}
          subtitle="From withdrawals"
          icon={<DollarSign className="w-5 h-5 text-white" />}
          color="red"
        />
        <StatCard
          title="New Users This Week"
          value={formatNumber(displayStats.newUsersWeek)}
          subtitle={`${displayStats.newUsersToday} today`}
          icon={<Calendar className="w-5 h-5 text-white" />}
          color="amber"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Deposits vs Withdrawals Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Deposits vs Withdrawals</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={combinedFinanceData}>
                <defs>
                  <linearGradient id="depositsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="withdrawalsGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  stroke="#64748b"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelFormatter={formatDate}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, '']}
                />
                <Legend />
                <Area
                  type="monotone"
                  dataKey="deposits"
                  stroke="#10b981"
                  fill="url(#depositsGradient)"
                  strokeWidth={2}
                  name="Deposits"
                />
                <Area
                  type="monotone"
                  dataKey="withdrawals"
                  stroke="#8b5cf6"
                  fill="url(#withdrawalsGradient)"
                  strokeWidth={2}
                  name="Withdrawals"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* New Users Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">New Users</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData?.usersChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis stroke="#64748b" fontSize={12} />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelFormatter={formatDate}
                  formatter={(value) => [value, 'Users']}
                />
                <Bar dataKey="value" fill="#f59e0b" radius={[4, 4, 0, 0]} name="New Users" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Charts Row 2 */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        {/* Revenue (Tax) Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Tax Revenue</h3>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData?.revenueChart || []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                <XAxis
                  dataKey="date"
                  tickFormatter={formatDate}
                  stroke="#64748b"
                  fontSize={12}
                />
                <YAxis
                  tickFormatter={(v) => `$${v}`}
                  stroke="#64748b"
                  fontSize={12}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                  labelFormatter={formatDate}
                  formatter={(value) => [`$${Number(value).toFixed(2)}`, 'Tax']}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="#ef4444"
                  strokeWidth={2}
                  dot={{ fill: '#ef4444', strokeWidth: 2 }}
                  name="Tax Collected"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tier Distribution Pie Chart */}
        <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
          <h3 className="text-lg font-semibold text-white mb-4">Machine Tier Distribution</h3>
          <div className="h-[300px]">
            {tierDistribution.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={tierDistribution}
                    dataKey="count"
                    nameKey="tier"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ payload, value }) => `T${payload.tier}: ${value}`}
                    labelLine={false}
                  >
                    {tierDistribution.map((entry, index) => (
                      <Cell
                        key={`cell-${entry.tier}`}
                        fill={TIER_COLORS[index % TIER_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                    formatter={(value, _name, props) => {
                      const payload = props.payload as TierDistribution;
                      return [
                        `${value} machines · $${payload.totalValue.toLocaleString()}`,
                        `Tier ${payload.tier}`,
                      ];
                    }}
                  />
                  <Legend
                    formatter={(value) => `Tier ${value}`}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-full text-slate-400">
                No active machines
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Machines Chart */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <h3 className="text-lg font-semibold text-white mb-4">New Machines Purchased</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData?.machinesChart || []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                stroke="#64748b"
                fontSize={12}
              />
              <YAxis stroke="#64748b" fontSize={12} />
              <Tooltip
                contentStyle={{ backgroundColor: '#1e293b', border: '1px solid #334155', borderRadius: '8px' }}
                labelFormatter={formatDate}
                formatter={(value) => [value, 'Machines']}
              />
              <Bar dataKey="value" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Machines" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">Quick Actions</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
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
            <span className="text-sm text-slate-300">Users</span>
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
            <span className="text-sm text-slate-300">Tiers</span>
          </Link>
          <Link
            href="/admin/deposits"
            className="
              flex flex-col items-center justify-center gap-2 p-4
              bg-slate-800 rounded-lg border border-slate-700
              hover:bg-slate-700 hover:border-amber-500/30
              transition-colors
            "
          >
            <ArrowDownToLine className="w-6 h-6 text-green-500" />
            <span className="text-sm text-slate-300">Deposits</span>
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
            <CreditCard className="w-6 h-6 text-purple-500" />
            <span className="text-sm text-slate-300">Withdrawals</span>
          </Link>
          <Link
            href="/admin/audit"
            className="
              flex flex-col items-center justify-center gap-2 p-4
              bg-slate-800 rounded-lg border border-slate-700
              hover:bg-slate-700 hover:border-amber-500/30
              transition-colors
            "
          >
            <Activity className="w-6 h-6 text-cyan-500" />
            <span className="text-sm text-slate-300">Audit Log</span>
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
            <DollarSign className="w-6 h-6 text-red-500" />
            <span className="text-sm text-slate-300">Settings</span>
          </Link>
        </div>
      </div>

      {/* System Status */}
      <div className="bg-slate-900 rounded-xl border border-slate-700 p-6">
        <h2 className="text-lg font-semibold text-white mb-4">System Status</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
            <span className="text-slate-400">API Server</span>
            <span className="flex items-center gap-2 text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Online
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
            <span className="text-slate-400">Database</span>
            <span className="flex items-center gap-2 text-green-400">
              <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              Connected
            </span>
          </div>
          <div className="flex items-center justify-between p-3 bg-slate-800 rounded-lg">
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
