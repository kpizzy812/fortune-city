'use client';

import { FileText } from 'lucide-react';
import { AuditTable } from '@/components/admin/audit/AuditTable';

export default function AdminAuditPage() {
  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold text-white">Audit Log</h1>
        </div>
        <p className="text-slate-400">
          View all administrative actions performed in the admin panel.
        </p>
      </div>

      {/* Audit Table */}
      <AuditTable />
    </div>
  );
}
