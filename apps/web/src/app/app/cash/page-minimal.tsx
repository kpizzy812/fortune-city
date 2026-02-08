'use client';

import { useAuthStore } from '@/stores/auth.store';

export default function CashPageMinimal() {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return (
      <div className="min-h-screen p-4 bg-[#0d0416] text-white">
        <h1>Not authenticated</h1>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-[#0d0416] text-white">
      <h1 className="text-2xl font-bold mb-4">Cash Page - Minimal</h1>
      <p>User: {user.firstName}</p>
      <p>Balance: ${user.fortuneBalance}</p>
      <p className="mt-4 text-green-400">✓ Page loaded successfully!</p>
    </div>
  );
}
