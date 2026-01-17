'use client';

import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { WithdrawalsTable } from '@/components/admin/withdrawals/WithdrawalsTable';
import { WithdrawalDetailModal } from '@/components/admin/withdrawals/WithdrawalDetailModal';

export default function AdminWithdrawalsPage() {
  const [selectedWithdrawalId, setSelectedWithdrawalId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <CreditCard className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold text-white">Withdrawals</h1>
        </div>
        <p className="text-slate-400">
          Monitor and manage user withdrawals. Approve, complete, or reject withdrawal requests.
        </p>
      </div>

      {/* Withdrawals Table */}
      <WithdrawalsTable onViewWithdrawal={setSelectedWithdrawalId} />

      {/* Withdrawal Detail Modal */}
      {selectedWithdrawalId && (
        <WithdrawalDetailModal
          withdrawalId={selectedWithdrawalId}
          onClose={() => setSelectedWithdrawalId(null)}
        />
      )}
    </div>
  );
}
