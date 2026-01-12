'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { BottomNavigation } from './BottomNavigation';
import { SidebarNavigation } from './SidebarNavigation';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuthStore();

  // Show navigation only for authenticated users
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Sidebar for desktop (lg+) */}
      <SidebarNavigation />

      {/* Main content area */}
      <div className="pb-20 lg:pb-0 lg:ml-64">
        {children}
      </div>

      {/* Bottom navigation for mobile (hidden on lg+) */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </>
  );
}
