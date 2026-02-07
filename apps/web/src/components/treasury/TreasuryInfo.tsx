'use client';

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Shield, ExternalLink, ArrowDownToLine, ArrowUpFromLine } from 'lucide-react';
import { useTreasuryStore } from '@/stores/treasury.store';

export function TreasuryInfo() {
  const t = useTranslations('treasury');
  const { info, isLoading, fetchInfo } = useTreasuryStore();

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  // Don't render anything while loading for the first time or if no data
  if (isLoading && !info) return null;
  if (!info) return null;

  return (
    <div className="relative rounded-xl p-[1px] mb-4 bg-gradient-to-r from-[#00ff88]/40 via-[#8b5cf6]/40 to-[#00ff88]/40">
      <div className="bg-[#1a0a2e] rounded-xl p-3 md:p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-[#00ff88]/10 flex items-center justify-center">
              <Shield className="w-4 h-4 text-[#00ff88]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">{t('title')}</h3>
              <p className="text-[10px] text-gray-500">{t('subtitle')}</p>
            </div>
          </div>
          <a
            href={info.solscanUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-[10px] md:text-xs text-[#00ff88]/70 hover:text-[#00ff88] transition-colors"
          >
            <span className="hidden sm:inline">{t('viewOnSolscan')}</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>

        {/* Balance */}
        <div className="text-center mb-3">
          <div className="text-2xl md:text-3xl font-bold text-white">
            $
            {info.currentBalance.toLocaleString('en-US', {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div className="text-[10px] text-gray-500 mt-0.5">USDT</div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 gap-2">
          <div className="bg-[#0d0416] rounded-lg p-2 flex items-center gap-2">
            <ArrowDownToLine className="w-3.5 h-3.5 text-[#00ff88] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-gray-500">{t('totalIn')}</div>
              <div className="text-xs font-semibold text-white truncate">
                ${info.totalDeposited.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
          <div className="bg-[#0d0416] rounded-lg p-2 flex items-center gap-2">
            <ArrowUpFromLine className="w-3.5 h-3.5 text-[#ff2d95] flex-shrink-0" />
            <div className="min-w-0">
              <div className="text-[10px] text-gray-500">{t('totalOut')}</div>
              <div className="text-xs font-semibold text-white truncate">
                ${info.totalPaidOut.toLocaleString('en-US', { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
