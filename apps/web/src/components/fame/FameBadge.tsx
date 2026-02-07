'use client';

import { Zap } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

interface FameBadgeProps {
  size?: 'sm' | 'md';
}

export function FameBadge({ size = 'sm' }: FameBadgeProps) {
  const { user } = useAuthStore();

  if (!user) return null;

  const fame = user.fame ?? 0;

  if (size === 'md') {
    return (
      <div className="flex items-center gap-1.5 bg-[#2a1a4e] rounded-lg px-3 py-1.5">
        <Zap className="w-4 h-4 text-[#facc15]" />
        <span className="text-sm font-mono font-bold text-[#facc15]">
          {fame.toLocaleString()}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1 text-[#facc15]" title={`Fame: ${fame}`}>
      <Zap className="w-3 h-3" />
      <span className="text-xs font-mono font-bold">{fame.toLocaleString()}</span>
    </div>
  );
}
