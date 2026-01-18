'use client';

import { ReactNode } from 'react';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { BottomNavigation } from './BottomNavigation';
import { SidebarNavigation } from './SidebarNavigation';
import { MobileHeader } from './MobileHeader';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuthStore();
  const { sidebarCollapsed } = useUIStore();

  // Show navigation only for authenticated users
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Sidebar for desktop (lg+) */}
      <SidebarNavigation />

      {/* Mobile header (hidden on lg+) */}
      <MobileHeader />

      {/* Main content area with dynamic margin */}
      <div
        className={`
          pb-20 lg:pb-0
          transition-all duration-300 ease-in-out
          ${sidebarCollapsed ? 'lg:ml-20' : 'lg:ml-64'}
        `}
      >
        {children}
      </div>

      {/* Bottom navigation for mobile (hidden on lg+) */}
      <div className="lg:hidden">
        <BottomNavigation />
      </div>
    </>
  );
}
