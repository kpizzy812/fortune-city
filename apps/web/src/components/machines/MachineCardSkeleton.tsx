'use client';

import { Skeleton } from '@/components/ui/Skeleton';

export function MachineCardSkeleton() {
  return (
    <div className="bg-[#2a1a4e] rounded-xl p-4 border border-[#ff2d95]/20">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <div className="flex-1">
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-3 w-12" />
        </div>
      </div>

      {/* Progress bar */}
      <div className="mb-3">
        <div className="flex justify-between mb-1">
          <Skeleton className="h-3 w-16" />
          <Skeleton className="h-3 w-8" />
        </div>
        <Skeleton className="h-2 w-full rounded-full" />
      </div>

      {/* Income */}
      <div className="mb-3">
        <Skeleton className="h-6 w-20" />
      </div>

      {/* Time remaining */}
      <div className="flex items-center gap-1 mb-4">
        <Skeleton className="w-4 h-4 rounded" />
        <Skeleton className="h-4 w-28" />
      </div>

      {/* Button area */}
      <div className="min-h-[96px] flex flex-col justify-center">
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    </div>
  );
}
