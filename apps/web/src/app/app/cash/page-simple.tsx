'use client';

import { useAuthStore } from '@/stores/auth.store';

export default function CashPageSimple() {
  const { user, token } = useAuthStore();

  if (!token || !user) {
    return <div>Not authenticated</div>;
  }

  return (
    <div className="min-h-screen p-4 bg-[#0d0416] text-white">
      <h1>Cash Page - Simple Test</h1>
      <p>User: {user.firstName}</p>
      <p>Balance: ${user.fortuneBalance}</p>
      <p>This is a simplified version to test if the page loads at all.</p>
    </div>
  );
}
