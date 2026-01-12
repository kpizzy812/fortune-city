'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { Home, ShoppingCart, FerrisWheel, Users, Wallet, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';

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

  const handleComingSoon = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    alert(`${label} is coming soon!`);
  };

  return (
    <aside
      className="
        hidden lg:flex lg:flex-col
        fixed left-0 top-0 bottom-0
        w-64 bg-[#1a0a2e]/95 backdrop-blur-lg
        border-r border-[#ff2d95]/20
        z-50
      "
    >
      {/* Logo */}
      <div className="p-6 border-b border-[#ff2d95]/10">
        <h1 className="text-xl font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
          FORTUNE CITY
        </h1>
        <p className="text-[#ffd700] text-xs mt-1 italic">
          Spin your fortune
        </p>
      </div>

      {/* User Info */}
      {user && (
        <div className="p-4 border-b border-[#ff2d95]/10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-[#ff2d95] to-[#00d4ff] flex items-center justify-center text-sm font-bold shrink-0">
              {user.firstName?.[0] || user.username?.[0] || '?'}
            </div>
            <div className="overflow-hidden">
              <p className="font-medium text-white text-sm truncate">
                {user.firstName} {user.lastName}
              </p>
              {user.username && (
                <p className="text-xs text-[#00d4ff] truncate">@{user.username}</p>
              )}
            </div>
          </div>
          <div className="mt-3 bg-[#2a1a4e] rounded-lg p-3">
            <p className="text-xs text-[#b0b0b0]">$FORTUNE</p>
            <p className="text-lg text-[#ffd700] font-mono font-bold">
              ${parseFloat(user.fortuneBalance).toFixed(2)}
            </p>
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          if (item.isComingSoon) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleComingSoon(e, item.label)}
                className="
                  w-full flex items-center gap-3
                  px-4 py-3 rounded-lg
                  text-[#6b6b6b]
                  hover:bg-[#2a1a4e]/50
                  transition-colors relative
                "
              >
                <item.icon className="w-5 h-5 opacity-50" />
                <span className="text-sm opacity-50">{item.label}</span>
                <span
                  className="
                    ml-auto text-[10px] px-2 py-0.5
                    bg-[#ffaa00]/20 text-[#ffaa00]
                    rounded-full
                  "
                >
                  Soon
                </span>
              </button>
            );
          }

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`
                w-full flex items-center gap-3
                px-4 py-3 rounded-lg
                transition-all relative
                ${
                  isActive
                    ? 'bg-[#ff2d95]/10 text-[#ff2d95]'
                    : 'text-[#b0b0b0] hover:bg-[#2a1a4e]/50 hover:text-white'
                }
              `}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSidebarTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff2d95] rounded-r-full"
                />
              )}
              <item.icon className="w-5 h-5" />
              <span className="text-sm font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-[#ff2d95]/10">
        <button
          onClick={clearAuth}
          className="
            w-full flex items-center gap-3
            px-4 py-3 rounded-lg
            text-[#b0b0b0] hover:text-[#ff4444] hover:bg-[#ff4444]/10
            transition-colors
          "
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <polyline points="16 17 21 12 16 7" />
            <line x1="21" y1="12" x2="9" y2="12" />
          </svg>
          <span className="text-sm">Logout</span>
        </button>
      </div>
    </aside>
  );
}
