'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { UsersTable } from '@/components/admin/users/UsersTable';
import { UserDetailModal } from '@/components/admin/users/UserDetailModal';

export default function AdminUsersPage() {
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div>
        <div className="flex items-center gap-3 mb-2">
          <Users className="w-8 h-8 text-amber-400" />
          <h1 className="text-3xl font-bold text-white">User Management</h1>
        </div>
        <p className="text-slate-400">
          View, filter, and manage platform users. Ban/unban users and explore referral trees.
        </p>
      </div>

      {/* Users Table */}
      <UsersTable onViewUser={setSelectedUserId} />

      {/* User Detail Modal */}
      {selectedUserId && (
        <UserDetailModal
          userId={selectedUserId}
          onClose={() => setSelectedUserId(null)}
        />
      )}
    </div>
  );
}
