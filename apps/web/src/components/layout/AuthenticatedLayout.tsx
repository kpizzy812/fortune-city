'use client';

import { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { useDepositsSocket } from '@/hooks/useDepositsSocket';
import { useWheelSocket } from '@/hooks/useWheelSocket';
import { useNotificationsSocket } from '@/hooks/useNotificationsSocket';
import { BottomNavigation } from './BottomNavigation';
import { SidebarNavigation } from './SidebarNavigation';

interface AuthenticatedLayoutProps {
  children: ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user } = useAuthStore();
  const { sidebarCollapsed } = useUIStore();
  const pathname = usePathname();

  const isAdminRoute = pathname.startsWith('/admin');

  // Global WebSocket listeners for real-time notifications
  useDepositsSocket();
  useWheelSocket(user?.id);
  useNotificationsSocket();

  // Admin pages have their own layout — skip main navigation
  if (isAdminRoute) {
    return <>{children}</>;
  }

  // Show navigation only for authenticated users
  if (!user) {
    return <>{children}</>;
  }

  return (
    <>
      {/* Sidebar for desktop (lg+) */}
      <SidebarNavigation />

      {/* Main content area with dynamic margin */}
      <div
        className={`
          pb-20 pb-[calc(5rem+env(safe-area-inset-bottom))] lg:pb-0
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
