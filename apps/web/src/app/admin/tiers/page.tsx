'use client';

import { TiersTable } from '@/components/admin/tiers/TiersTable';

export default function AdminTiersPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Tier Management</h1>
        <p className="text-slate-400 mt-1">
          Manage machine tiers, pricing, and availability
        </p>
      </div>

      <TiersTable showActions />
    </div>
  );
}
