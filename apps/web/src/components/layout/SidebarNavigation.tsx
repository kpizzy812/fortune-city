'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, ShoppingCart, FerrisWheel, Users, Wallet, ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';

interface NavItem {
  icon: LucideIcon;
  label: string;
  href: string;
  isComingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, label: 'Hall', href: '/' },
  { icon: ShoppingCart, label: 'Shop', href: '/shop' },
  { icon: FerrisWheel, label: 'Wheel', href: '/wheel', isComingSoon: true },
  { icon: Users, label: 'Refs', href: '/refs', isComingSoon: true },
  { icon: Wallet, label: 'Cash', href: '/cash', isComingSoon: true },
];

export function SidebarNavigation() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();

  const handleComingSoon = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    alert(`${label} is coming soon!`);
  };

  return (
    <aside
      className={`
        hidden lg:flex lg:flex-col
        fixed left-0 top-0 bottom-0
        bg-[#1a0a2e]/95 backdrop-blur-lg
        border-r border-[#ff2d95]/20
        z-50 transition-all duration-300 ease-in-out
        ${sidebarCollapsed ? 'w-20' : 'w-64'}
      `}
    >
      {/* Toggle Button */}
      <button
        onClick={toggleSidebar}
        className="
          absolute -right-3 top-8
          w-6 h-6 rounded-full
          bg-[#2a1a4e] border border-[#ff2d95]/30
          flex items-center justify-center
          text-[#b0b0b0] hover:text-white hover:border-[#ff2d95]
          transition-colors z-10
        "
        title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        {sidebarCollapsed ? (
          <ChevronRight className="w-4 h-4" />
        ) : (
          <ChevronLeft className="w-4 h-4" />
        )}
      </button>

      {/* Logo */}
      <div className={`p-4 border-b border-[#ff2d95]/10 ${sidebarCollapsed ? 'px-2' : 'p-6'}`}>
        {sidebarCollapsed ? (
          <div className="w-12 h-12 mx-auto rounded-xl bg-gradient-to-br from-[#ff2d95] to-[#00d4ff] flex items-center justify-center">
            <span className="text-lg font-bold text-white">FC</span>
          </div>
        ) : (
          <>
            <h1 className="text-xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
              FORTUNE CITY
            </h1>
            <p className="text-[#ffd700] text-xs mt-1 italic">
              Spin your fortune
            </p>
          </>
        )}
      </div>

      {/* User Info */}
      {user && (
        <div className={`border-b border-[#ff2d95]/10 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <div
              className={`
                rounded-full bg-gradient-to-br from-[#ff2d95] to-[#00d4ff]
                flex items-center justify-center font-bold shrink-0
                ${sidebarCollapsed ? 'w-12 h-12 text-sm' : 'w-10 h-10 text-sm'}
              `}
              title={sidebarCollapsed ? `${user.firstName} ${user.lastName}` : undefined}
            >
              {user.firstName?.[0] || user.username?.[0] || '?'}
            </div>
            {!sidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="font-medium text-white text-sm truncate">
                  {user.firstName} {user.lastName}
                </p>
                {user.username && (
                  <p className="text-xs text-[#00d4ff] truncate">@{user.username}</p>
                )}
              </div>
            )}
          </div>
          {!sidebarCollapsed && (
            <div className="mt-3 bg-[#2a1a4e] rounded-lg p-3">
              <p className="text-xs text-[#b0b0b0]">$FORTUNE</p>
              <p className="text-lg text-[#ffd700] font-mono font-bold">
                ${parseFloat(user.fortuneBalance).toFixed(2)}
              </p>
            </div>
          )}
          {sidebarCollapsed && (
            <div
              className="mt-2 text-center"
              title={`$${parseFloat(user.fortuneBalance).toFixed(2)}`}
            >
              <p className="text-xs text-[#ffd700] font-mono font-bold truncate">
                ${parseFloat(user.fortuneBalance).toFixed(0)}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          if (item.isComingSoon) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleComingSoon(e, item.label)}
                className={`
                  w-full flex items-center
                  rounded-lg text-[#6b6b6b]
                  hover:bg-[#2a1a4e]/50 transition-colors relative
                  ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'}
                `}
                title={sidebarCollapsed ? `${item.label} (Coming Soon)` : undefined}
              >
                <item.icon className="w-5 h-5 opacity-50 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="text-sm opacity-50">{item.label}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#ffaa00]/20 text-[#ffaa00] rounded-full">
                      Soon
                    </span>
                  </>
                )}
                {sidebarCollapsed && (
                  <span className="absolute -top-1 -right-1 w-2 h-2 bg-[#ffaa00] rounded-full" />
                )}
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                w-full flex items-center
                rounded-lg transition-all relative
                ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'}
                ${
                  isActive
                    ? 'bg-[#ff2d95]/10 text-[#ff2d95]'
                    : 'text-[#b0b0b0] hover:bg-[#2a1a4e]/50 hover:text-white'
                }
              `}
              title={sidebarCollapsed ? item.label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSidebarTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff2d95] rounded-r-full"
                />
              )}
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className={`border-t border-[#ff2d95]/10 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        <button
          onClick={clearAuth}
          className={`
            w-full flex items-center
            rounded-lg text-[#b0b0b0]
            hover:text-[#ff4444] hover:bg-[#ff4444]/10
            transition-colors
            ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'}
          `}
          title={sidebarCollapsed ? 'Logout' : undefined}
        >
          <LogOut className="w-5 h-5 shrink-0" />
          {!sidebarCollapsed && <span className="text-sm">Logout</span>}
        </button>
      </div>
    </aside>
  );
}
