'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Home, ShoppingCart, FerrisWheel, Users, Wallet, type LucideIcon } from 'lucide-react';

interface NavItem {
  icon: LucideIcon;
  labelKey: 'hall' | 'shop' | 'wheel' | 'refs' | 'cash';
  href: string;
  isComingSoon?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { icon: Home, labelKey: 'hall', href: '/' },
  { icon: ShoppingCart, labelKey: 'shop', href: '/shop' },
  { icon: FerrisWheel, labelKey: 'wheel', href: '/wheel' },
  { icon: Users, labelKey: 'refs', href: '/refs' },
  { icon: Wallet, labelKey: 'cash', href: '/cash' },
];

export function BottomNavigation() {
  const pathname = usePathname();
  const t = useTranslations('nav');
  const tCommon = useTranslations('common');

  const handleComingSoon = (e: React.MouseEvent, labelKey: string) => {
    e.preventDefault();
    const label = t(labelKey as keyof IntlMessages['nav']);
    toast.info(tCommon('comingSoon', { feature: label }), {
      description: tCommon('stayTuned'),
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
          const label = t(item.labelKey);

          if (item.isComingSoon) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleComingSoon(e, item.labelKey)}
                className="
                  flex flex-col items-center justify-center
                  w-16 py-1 relative
                  text-[#6b6b6b]
                  transition-colors
                "
              >
                <item.icon className="w-5 h-5 opacity-50" />
                <span className="text-xs mt-0.5 opacity-50">{label}</span>
                <span
                  className="
                    absolute -top-1 -right-1
                    text-[8px] px-1 py-0.5
                    bg-[#ffaa00]/20 text-[#ffaa00]
                    rounded-full
                  "
                >
                  {tCommon('soon')}
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
              <span className="text-xs mt-0.5">{label}</span>
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
