'use client';

import { usePathname } from 'next/navigation';
import { Bell, Menu } from 'lucide-react';

// Map routes to titles
const ROUTE_TITLES: Record<string, string> = {
  '/admin/dashboard': 'Dashboard',
  '/admin/users': 'User Management',
  '/admin/tiers': 'Tier Management',
  '/admin/settings': 'Settings',
  '/admin/deposits': 'Deposits',
  '/admin/withdrawals': 'Withdrawals',
  '/admin/audit': 'Audit Log',
};

interface AdminHeaderProps {
  onMenuClick?: () => void;
}

export function AdminHeader({ onMenuClick }: AdminHeaderProps) {
  const pathname = usePathname();

  // Get page title from route
  const getPageTitle = () => {
    // Check for exact match first
    if (ROUTE_TITLES[pathname]) {
      return ROUTE_TITLES[pathname];
    }

    // Check for partial matches (e.g., /admin/users/123)
    for (const [route, title] of Object.entries(ROUTE_TITLES)) {
      if (pathname.startsWith(route)) {
        return title;
      }
    }

    return 'Admin Panel';
  };

  return (
    <header
      className="
        sticky top-0 z-40
        bg-slate-900/95 backdrop-blur-sm
        border-b border-slate-700
        px-4 lg:px-8 py-4
      "
    >
      <div className="flex items-center justify-between">
        {/* Left side - Mobile menu & Title */}
        <div className="flex items-center gap-4">
          <button
            onClick={onMenuClick}
            className="lg:hidden p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="text-xl font-semibold text-white">
            {getPageTitle()}
          </h1>
        </div>

        {/* Right side - Actions */}
        <div className="flex items-center gap-3">
          <button
            className="
              p-2 text-slate-400 hover:text-white
              rounded-lg hover:bg-slate-800
              transition-colors relative
            "
          >
            <Bell className="w-5 h-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-amber-500 rounded-full" />
          </button>
        </div>
      </div>
    </header>
  );
}
