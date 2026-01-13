'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useReferralsStore } from '@/stores/referrals.store';
import { Button } from '@/components/ui/Button';

const REFERRAL_RATES = [
  { level: 1, rate: '5%', color: '#00ff88' },
  { level: 2, rate: '3%', color: '#00d4ff' },
  { level: 3, rate: '1%', color: '#ff2d95' },
];

export default function RefsPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuthStore();
  const {
    stats,
    referrals,
    canWithdraw,
    isLoading,
    isWithdrawing,
    error,
    fetchStats,
    fetchReferrals,
    checkCanWithdraw,
    withdrawBalance,
    clearError,
  } = useReferralsStore();

  const [copied, setCopied] = useState(false);
  const hasFetched = useRef(false);

  // Redirect if not authenticated
  useEffect(() => {
    if (!user || !token) {
      router.push('/');
    }
  }, [user, token, router]);

  // Load data
  useEffect(() => {
    if (token && !hasFetched.current) {
      hasFetched.current = true;
      fetchStats(token);
      fetchReferrals(token);
      checkCanWithdraw(token);
    }
  }, [token, fetchStats, fetchReferrals, checkCanWithdraw]);

  // Generate referral link
  const referralLink = stats?.referralCode
    ? `${window.location.origin}/?ref=${stats.referralCode}`
    : '';

  // Copy to clipboard
  const handleCopy = useCallback(async () => {
    if (!referralLink) return;
    try {
      await navigator.clipboard.writeText(referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = referralLink;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [referralLink]);

  // Handle withdraw
  const handleWithdraw = useCallback(async () => {
    if (!token || !stats || stats.referralBalance <= 0) return;
    try {
      await withdrawBalance(token);
      await refreshUser();
    } catch {
      // Error is handled in store
    }
  }, [token, stats, withdrawBalance, refreshUser]);

  // Loading state
  if (!user || !token) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#00d4ff] border-t-transparent" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-4 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <header className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl lg:text-3xl font-bold text-[#00d4ff]">
              My Referrals
            </h1>
            <p className="text-sm text-[#b0b0b0]">
              Invite friends and earn rewards
            </p>
          </div>
          {stats && (
            <div className="text-right">
              <p className="text-xs text-[#b0b0b0]">Referral Balance</p>
              <p className="text-lg lg:text-xl text-[#ffd700] font-mono font-bold">
                ${stats.referralBalance.toFixed(2)}
              </p>
            </div>
          )}
        </header>

        {/* Referral Link Card */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#00d4ff]/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            Your Referral Link
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#1a0a2e] rounded-lg px-4 py-3 font-mono text-sm text-[#b0b0b0] truncate">
              {isLoading ? 'Loading...' : referralLink || 'No referral code'}
            </div>
            <Button
              onClick={handleCopy}
              variant="secondary"
              className="shrink-0"
              disabled={!referralLink}
            >
              {copied ? 'Copied!' : 'Copy'}
            </Button>
          </div>
          <p className="mt-3 text-xs text-[#b0b0b0]">
            Share this link with friends. You&apos;ll earn a percentage of their
            machine purchases!
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">Total Referrals</p>
            <p className="text-2xl font-bold text-white">
              {stats?.totalReferrals ?? 0}
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00ff88]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">Active Referrals</p>
            <p className="text-2xl font-bold text-[#00ff88]">
              {stats?.activeReferrals ?? 0}
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ffd700]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">Total Earned</p>
            <p className="text-2xl font-bold text-[#ffd700]">
              ${stats?.totalEarned.toFixed(2) ?? '0.00'}
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00d4ff]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">Ref Balance</p>
            <p className="text-2xl font-bold text-[#00d4ff]">
              ${stats?.referralBalance.toFixed(2) ?? '0.00'}
            </p>
          </div>
        </div>

        {/* Level Breakdown */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#ff2d95]/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Earnings by Level
          </h2>
          <div className="space-y-3">
            {REFERRAL_RATES.map(({ level, rate, color }) => {
              const levelData = stats?.byLevel.find((l) => l.level === level);
              return (
                <div
                  key={level}
                  className="flex items-center justify-between bg-[#1a0a2e] rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center font-bold"
                      style={{ backgroundColor: color + '20', color }}
                    >
                      {level}
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Line {level}{' '}
                        <span className="text-[#b0b0b0]">({rate})</span>
                      </p>
                      <p className="text-xs text-[#b0b0b0]">
                        {levelData?.count ?? 0} referrals
                      </p>
                    </div>
                  </div>
                  <p className="font-mono font-bold" style={{ color }}>
                    ${levelData?.earned.toFixed(2) ?? '0.00'}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        {/* Withdraw Section */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#ffd700]/30 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Withdraw to Balance
              </h2>
              <p className="text-sm text-[#b0b0b0] mt-1">
                {canWithdraw
                  ? 'Transfer your referral earnings to your main balance'
                  : 'You need an active machine to withdraw referral balance'}
              </p>
            </div>
            <Button
              onClick={handleWithdraw}
              variant="primary"
              disabled={
                !canWithdraw ||
                isWithdrawing ||
                !stats ||
                stats.referralBalance <= 0
              }
            >
              {isWithdrawing ? 'Processing...' : 'Withdraw All'}
            </Button>
          </div>
          {!canWithdraw && (
            <div className="mt-3 p-3 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
              <p className="text-sm text-[#ff4444]">
                Purchase at least one machine to unlock withdrawals
              </p>
            </div>
          )}
        </div>

        {/* Error display */}
        {error && (
          <div className="mb-6 p-4 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
            <p className="text-[#ff4444] text-sm">{error}</p>
            <button
              onClick={clearError}
              className="text-[#ff4444] text-xs underline mt-1"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Recent Referrals */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#00d4ff]/30">
          <h2 className="text-lg font-semibold text-white mb-4">
            Recent Referrals
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#00d4ff] border-t-transparent" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">👥</p>
              <p className="text-[#b0b0b0]">No referrals yet</p>
              <p className="text-sm text-[#b0b0b0] mt-1">
                Share your link to start earning!
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {referrals.slice(0, 10).map((ref) => (
                <div
                  key={ref.id}
                  className="flex items-center justify-between bg-[#1a0a2e] rounded-lg px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-2 h-2 rounded-full ${
                        ref.isActive ? 'bg-[#00ff88]' : 'bg-[#b0b0b0]'
                      }`}
                    />
                    <div>
                      <p className="text-white font-medium">
                        {ref.username
                          ? `@${ref.username}`
                          : ref.firstName || 'Anonymous'}
                      </p>
                      <p className="text-xs text-[#b0b0b0]">
                        Line {ref.level} &bull;{' '}
                        {new Date(ref.joinedAt).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[#ffd700] font-mono font-bold">
                      +${ref.totalContributed.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#b0b0b0]">
                      {ref.isActive ? 'Active' : 'Inactive'}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-6 bg-[#1a0a2e] rounded-xl p-4 border border-[#00d4ff]/20">
          <h3 className="text-sm font-semibold text-[#00d4ff] mb-2">
            How it works
          </h3>
          <ul className="text-sm text-[#b0b0b0] space-y-1">
            <li>
              &bull; Earn <span className="text-[#00ff88]">5%</span> from direct
              referrals (Line 1)
            </li>
            <li>
              &bull; Earn <span className="text-[#00d4ff]">3%</span> from their
              referrals (Line 2)
            </li>
            <li>
              &bull; Earn <span className="text-[#ff2d95]">1%</span> from 3rd
              level referrals (Line 3)
            </li>
            <li>
              &bull; Bonuses are paid from{' '}
              <span className="text-white">fresh deposits only</span>
            </li>
            <li>
              &bull; Active referral = has purchased machine with own funds
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
