'use client';

import { useState } from 'react';
import { ArrowDownToLine } from 'lucide-react';
import { DepositsTable } from '@/components/admin/deposits/DepositsTable';
import { DepositDetailModal } from '@/components/admin/deposits/DepositDetailModal';

export default function AdminDepositsPage() {
  const [selectedDepositId, setSelectedDepositId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <ArrowDownToLine className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold text-white">Deposits</h1>
        </div>
        <p className="text-slate-400">
          Monitor user deposits. Manually credit failed deposits or retry processing.
        </p>
      </div>

      {/* Deposits Table */}
      <DepositsTable onViewDeposit={setSelectedDepositId} />

      {/* Deposit Detail Modal */}
      {selectedDepositId && (
        <DepositDetailModal
          depositId={selectedDepositId}
          onClose={() => setSelectedDepositId(null)}
        />
      )}
    </div>
  );
}
