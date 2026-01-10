'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { BottomNavigation } from './BottomNavigation';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuthStore();

  // Show bottom navigation only for authenticated users
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      <div className="pb-20">{children}</div>
      <BottomNavigation />
    </>
  );
}
