'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Home, ShoppingCart, FerrisWheel, Users, Wallet, type LucideIcon } from 'lucide-react';

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

export function BottomNavigation() {
  const pathname = usePathname();

  const handleComingSoon = (e: React.MouseEvent, label: string) => {
    e.preventDefault();
    toast.info(`${label} is coming soon!`, {
      description: 'Stay tuned for updates',
    });
  };

  return (
    <nav
      className="
        fixed bottom-0 left-0 right-0
        bg-[#1a0a2e]/95 backdrop-blur-lg
        border-t border-[#ff2d95]/20
        px-2 py-2 pb-[env(safe-area-inset-bottom)]
        z-50
      "
    >
      <div className="flex items-center justify-around max-w-lg mx-auto">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;

          if (item.isComingSoon) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleComingSoon(e, item.label)}
                className="
                  flex flex-col items-center justify-center
                  w-16 py-1 relative
                  text-[#6b6b6b]
                  transition-colors
                "
              >
                <item.icon className="w-5 h-5 opacity-50" />
                <span className="text-xs mt-0.5 opacity-50">{item.label}</span>
                <span
                  className="
                    absolute -top-1 -right-1
                    text-[8px] px-1 py-0.5
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
                flex flex-col items-center justify-center
                w-16 py-1 relative
                transition-colors
                ${isActive ? 'text-[#ff2d95]' : 'text-[#b0b0b0] hover:text-white'}
              `}
            >
              <motion.div
                animate={isActive ? { scale: [1, 1.2, 1] } : {}}
                transition={{ duration: 0.3 }}
              >
                <item.icon className="w-5 h-5" />
              </motion.div>
              <span className="text-xs mt-0.5">{item.label}</span>
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="
                    absolute -bottom-2 left-1/2 -translate-x-1/2
                    w-1 h-1 rounded-full
                    bg-[#ff2d95]
                    shadow-[0_0_10px_rgba(255,45,149,0.8)]
                  "
                />
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
