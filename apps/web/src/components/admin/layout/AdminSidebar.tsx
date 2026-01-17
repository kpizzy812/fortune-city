'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Users,
  Layers,
  Settings,
  CreditCard,
  ArrowDownToLine,
  FileText,
  LogOut,
  type LucideIcon,
} from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin/admin-auth.store';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
}

const NAV_ITEMS: NavItem[] = [
  { icon: LayoutDashboard, label: 'Dashboard', href: '/admin/dashboard' },
  { icon: Users, label: 'Users', href: '/admin/users' },
  { icon: Layers, label: 'Tiers', href: '/admin/tiers' },
  { icon: Settings, label: 'Settings', href: '/admin/settings' },
  { icon: ArrowDownToLine, label: 'Deposits', href: '/admin/deposits' },
  { icon: CreditCard, label: 'Withdrawals', href: '/admin/withdrawals' },
  { icon: FileText, label: 'Audit Log', href: '/admin/audit' },
];

export function AdminSidebar() {
  const pathname = usePathname();
  const { admin, logout } = useAdminAuthStore();

  const handleLogout = () => {
    logout();
  };

  return (
    <aside
      className="
        hidden lg:flex lg:flex-col
        fixed left-0 top-0 bottom-0 w-64
        bg-slate-900
        border-r border-slate-700
        z-50
      "
    >
      {/* Logo */}
      <div className="p-6 border-b border-slate-700">
        <h1 className="text-xl font-bold text-white">
          Fortune City
        </h1>
        <p className="text-amber-500 text-xs mt-1">
          Admin Panel
        </p>
      </div>

      {/* Admin Info */}
      {admin && (
        <div className="p-4 border-b border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {admin.username.charAt(0).toUpperCase()}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-white truncate">
                {admin.username}
              </p>
              <p className="text-xs text-slate-400">
                Administrator
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 overflow-y-auto">
        <ul className="space-y-1">
          {NAV_ITEMS.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
            const Icon = item.icon;

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg
                    transition-all duration-200
                    ${isActive
                      ? 'bg-amber-500/20 text-amber-500 border border-amber-500/30'
                      : 'text-slate-400 hover:text-white hover:bg-slate-800'
                    }
                  `}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  <span className="text-sm font-medium">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={handleLogout}
          className="
            flex items-center gap-3 w-full px-3 py-2.5 rounded-lg
            text-slate-400 hover:text-red-400 hover:bg-slate-800
            transition-all duration-200
          "
        >
          <LogOut className="w-5 h-5 flex-shrink-0" />
          <span className="text-sm font-medium">Logout</span>
        </button>
      </div>
    </aside>
  );
}
