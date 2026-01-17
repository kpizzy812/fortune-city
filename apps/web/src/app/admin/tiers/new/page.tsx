'use client';

import { TierForm } from '@/components/admin/tiers/TierForm';

export default function NewTierPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Create New Tier</h1>
        <p className="text-slate-400 mt-1">
          Add a new machine tier to the system
        </p>
      </div>

      <TierForm mode="create" />
    </div>
  );
}
