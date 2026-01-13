'use client';

import { useEffect, useRef, useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';
import { useReferralsStore } from '@/stores/referrals.store';
import { Button } from '@/components/ui/Button';
import { LanguageSwitcher } from '@/components/layout/LanguageSwitcher';

const REFERRAL_RATES = [
  { level: 1, rate: '5%', color: '#00ff88' },
  { level: 2, rate: '3%', color: '#00d4ff' },
  { level: 3, rate: '1%', color: '#ff2d95' },
];

export default function RefsPage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuthStore();
  const t = useTranslations('refs');
  const tCommon = useTranslations('common');

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
              {t('title')}
            </h1>
            <p className="text-sm text-[#b0b0b0]">
              {t('subtitle')}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {stats && (
              <div className="text-right">
                <p className="text-xs text-[#b0b0b0]">{t('referralBalance')}</p>
                <p className="text-lg lg:text-xl text-[#ffd700] font-mono font-bold">
                  ${stats.referralBalance.toFixed(2)}
                </p>
              </div>
            )}
            <div className="lg:hidden">
              <LanguageSwitcher />
            </div>
          </div>
        </header>

        {/* Referral Link Card */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#00d4ff]/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-3">
            {t('yourReferralLink')}
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 bg-[#1a0a2e] rounded-lg px-4 py-3 font-mono text-sm text-[#b0b0b0] truncate">
              {isLoading ? tCommon('loading') : referralLink || t('noReferralCode')}
            </div>
            <Button
              onClick={handleCopy}
              variant="secondary"
              className="shrink-0"
              disabled={!referralLink}
            >
              {copied ? tCommon('copied') : tCommon('copy')}
            </Button>
          </div>
          <p className="mt-3 text-xs text-[#b0b0b0]">
            {t('shareHint')}
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">{t('totalReferrals')}</p>
            <p className="text-2xl font-bold text-white">
              {stats?.totalReferrals ?? 0}
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00ff88]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">{t('activeReferrals')}</p>
            <p className="text-2xl font-bold text-[#00ff88]">
              {stats?.activeReferrals ?? 0}
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ffd700]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">{t('totalEarned')}</p>
            <p className="text-2xl font-bold text-[#ffd700]">
              ${stats?.totalEarned.toFixed(2) ?? '0.00'}
            </p>
          </div>
          <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#00d4ff]/30">
            <p className="text-xs text-[#b0b0b0] mb-1">{t('refBalance')}</p>
            <p className="text-2xl font-bold text-[#00d4ff]">
              ${stats?.referralBalance.toFixed(2) ?? '0.00'}
            </p>
          </div>
        </div>

        {/* Level Breakdown */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#ff2d95]/30 mb-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('earningsByLevel')}
          </h2>
          <div className="space-y-3">
            {REFERRAL_RATES.map(({ level, color }) => {
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
                        {t(`line${level}` as 'line1' | 'line2' | 'line3')}
                      </p>
                      <p className="text-xs text-[#b0b0b0]">
                        {levelData?.count ?? 0} {t('referrals')}
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
                {t('withdrawToBalance')}
              </h2>
              <p className="text-sm text-[#b0b0b0] mt-1">
                {canWithdraw
                  ? t('withdrawDescription')
                  : t('needActiveMachine')}
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
              {isWithdrawing ? tCommon('processing') : t('withdrawAll')}
            </Button>
          </div>
          {!canWithdraw && (
            <div className="mt-3 p-3 bg-[#ff4444]/10 border border-[#ff4444]/30 rounded-lg">
              <p className="text-sm text-[#ff4444]">
                {t('purchaseMachineToUnlock')}
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
              {tCommon('dismiss')}
            </button>
          </div>
        )}

        {/* Recent Referrals */}
        <div className="bg-[#2a1a4e] rounded-xl p-4 lg:p-6 border border-[#00d4ff]/30">
          <h2 className="text-lg font-semibold text-white mb-4">
            {t('recentReferrals')}
          </h2>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-4 border-[#00d4ff] border-t-transparent" />
            </div>
          ) : referrals.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-4xl mb-2">👥</p>
              <p className="text-[#b0b0b0]">{t('noReferralsYet')}</p>
              <p className="text-sm text-[#b0b0b0] mt-1">
                {t('shareToStart')}
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
                      {ref.isActive ? tCommon('active') : tCommon('inactive')}
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
            {t('howItWorks')}
          </h3>
          <ul className="text-sm text-[#b0b0b0] space-y-1">
            <li>
              &bull; {t('howItWorks1')}
            </li>
            <li>
              &bull; {t('howItWorks2')}
            </li>
            <li>
              &bull; {t('howItWorks3')}
            </li>
            <li>
              &bull; {t('howItWorks4')}
            </li>
            <li>
              &bull; {t('howItWorks5')}
            </li>
          </ul>
        </div>
      </div>
    </main>
  );
}
