'use client';

import { useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { TierForm } from '@/components/admin/tiers/TierForm';
import { useAdminTiersStore } from '@/stores/admin/admin-tiers.store';

export default function EditTierPage() {
  const params = useParams();
  const tierNumber = parseInt(params.tier as string, 10);

  const { selectedTier, isLoading, error, fetchTier, clearSelectedTier } =
    useAdminTiersStore();

  useEffect(() => {
    if (tierNumber) {
      fetchTier(tierNumber);
    }

    return () => {
      clearSelectedTier();
    };
  }, [tierNumber, fetchTier, clearSelectedTier]);

  if (isLoading && !selectedTier) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-10 h-10 text-amber-500 animate-spin" />
      </div>
    );
  }

  if (error && !selectedTier) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-6 text-center">
        <p className="text-red-400 text-lg">{error}</p>
        <Link
          href="/admin/tiers"
          className="inline-block mt-4 px-4 py-2 bg-slate-800 text-slate-300 rounded-lg hover:bg-slate-700"
        >
          Back to Tiers
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Edit Tier #{tierNumber}
        </h1>
        <p className="text-slate-400 mt-1">
          {selectedTier
            ? `Editing "${selectedTier.name}"`
            : 'Loading tier data...'}
        </p>
      </div>

      {selectedTier && (
        <TierForm
          key={selectedTier.id}
          mode="edit"
          initialData={selectedTier}
          tierNumber={tierNumber}
        />
      )}
    </div>
  );
}
