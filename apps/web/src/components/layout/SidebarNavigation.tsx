'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { Home, ShoppingCart, FerrisWheel, Users, Wallet, ChevronLeft, ChevronRight, LogOut, type LucideIcon } from 'lucide-react';
import { useAuthStore } from '@/stores/auth.store';
import { useUIStore } from '@/stores/ui.store';
import { LanguageSwitcher } from './LanguageSwitcher';
import { MusicToggleButton } from './MusicToggleButton';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { FameBadge } from '@/components/fame/FameBadge';
import { formatUserDisplayName, getUserInitial } from '@/lib/utils';
import { useFeedback } from '@/hooks/useFeedback';

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

export function SidebarNavigation() {
  const pathname = usePathname();
  const { user, clearAuth } = useAuthStore();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const t = useTranslations('nav');
  const tBrand = useTranslations('brand');
  const tCommon = useTranslations('common');
  const tProfile = useTranslations('profile');
  const { click: fbClick } = useFeedback();
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const displayName = user ? formatUserDisplayName(user) : '';
  const userInitial = user ? getUserInitial(user) : '?';

  const handleComingSoon = (e: React.MouseEvent, labelKey: string) => {
    e.preventDefault();
    const label = t(labelKey as keyof IntlMessages['nav']);
    toast.info(tCommon('comingSoon', { feature: label }), {
      description: tCommon('stayTuned'),
    });
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
        title={sidebarCollapsed ? t('expandSidebar') : t('collapseSidebar')}
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
              {tBrand('name')}
            </h1>
            <p className="text-[#ffd700] text-xs mt-1 italic">
              {tBrand('tagline')}
            </p>
          </>
        )}
      </div>

      {/* User Info */}
      {user && (
        <div className={`border-b border-[#ff2d95]/10 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
          <div className={`flex items-center ${sidebarCollapsed ? 'justify-center' : 'gap-3'}`}>
            <button
              onClick={() => setIsProfileOpen(true)}
              className={`
                rounded-full flex items-center justify-center font-bold shrink-0
                transition-shadow cursor-pointer
                ${user.isOG
                  ? 'bg-gradient-to-br from-[#ffd700] via-[#ff2d95] to-[#00d4ff] ring-2 ring-[#ffd700]/50 hover:shadow-[0_0_15px_rgba(255,215,0,0.5)]'
                  : 'bg-gradient-to-br from-[#ff2d95] to-[#00d4ff] hover:shadow-[0_0_15px_rgba(255,45,149,0.5)]'
                }
                ${sidebarCollapsed ? 'w-12 h-12 text-sm' : 'w-10 h-10 text-sm'}
              `}
              title={sidebarCollapsed ? `${displayName} — ${tProfile('title')}` : tProfile('title')}
            >
              {userInitial}
            </button>
            {!sidebarCollapsed && (
              <>
                <button
                  onClick={() => setIsProfileOpen(true)}
                  className="overflow-hidden text-left hover:opacity-80 transition-opacity flex-1"
                >
                  <p className="font-medium text-white text-sm truncate">
                    {displayName}
                  </p>
                  {user.username && (
                    <p className="text-xs text-[#00d4ff] truncate">@{user.username}</p>
                  )}
                </button>
                <NotificationBell />
              </>
            )}
          </div>
          {sidebarCollapsed && (
            <div className="mt-2 flex justify-center">
              <NotificationBell />
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="mt-3 bg-[#2a1a4e] rounded-lg p-3">
              <p className="text-lg lg:text-xl text-[#ffd700] font-mono font-bold">
                ${parseFloat(user.fortuneBalance).toFixed(2)}
              </p>
              {parseFloat(user.bonusFortune) > 0 && (
                <p className="text-xs text-[#00d4ff] font-mono mt-0.5" title={t('bonusFortune')}>
                  +${parseFloat(user.bonusFortune).toFixed(2)} {t('bonus')}
                </p>
              )}
              <div className="mt-1">
                <FameBadge size="sm" />
              </div>
            </div>
          )}
          {sidebarCollapsed && (
            <div
              className="mt-2 text-center"
              title={`$${parseFloat(user.fortuneBalance).toFixed(2)}${parseFloat(user.bonusFortune) > 0 ? ` + $${parseFloat(user.bonusFortune).toFixed(2)} ${t('bonus')}` : ''}`}
            >
              <p className="text-xs text-[#ffd700] font-mono font-bold truncate">
                ${parseFloat(user.fortuneBalance).toFixed(0)}
              </p>
              <div className="mt-1 flex justify-center">
                <FameBadge size="sm" />
              </div>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <nav className={`flex-1 space-y-1 overflow-y-auto ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href;
          const label = t(item.labelKey);

          if (item.isComingSoon) {
            return (
              <button
                key={item.href}
                onClick={(e) => handleComingSoon(e, item.labelKey)}
                className={`
                  w-full flex items-center
                  rounded-lg text-[#6b6b6b]
                  hover:bg-[#2a1a4e]/50 transition-colors relative
                  ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3'}
                `}
                title={sidebarCollapsed ? `${label} (${tCommon('soon')})` : undefined}
              >
                <item.icon className="w-5 h-5 opacity-50 shrink-0" />
                {!sidebarCollapsed && (
                  <>
                    <span className="text-sm opacity-50">{label}</span>
                    <span className="ml-auto text-[10px] px-2 py-0.5 bg-[#ffaa00]/20 text-[#ffaa00] rounded-full">
                      {tCommon('soon')}
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
              onClick={fbClick}
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
              title={sidebarCollapsed ? label : undefined}
            >
              {isActive && (
                <motion.div
                  layoutId="activeSidebarTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#ff2d95] rounded-r-full"
                />
              )}
              <item.icon className="w-5 h-5 shrink-0" />
              {!sidebarCollapsed && (
                <span className="text-sm font-medium">{label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Language & Logout */}
      <div className={`border-t border-[#ff2d95]/10 ${sidebarCollapsed ? 'p-2' : 'p-4'}`}>
        <div className={`flex items-center ${sidebarCollapsed ? 'flex-col gap-2' : 'gap-2'}`}>
          <MusicToggleButton collapsed={sidebarCollapsed} />
          <LanguageSwitcher collapsed={sidebarCollapsed} />
          <button
            onClick={clearAuth}
            className={`
              flex items-center
              rounded-lg text-[#b0b0b0]
              hover:text-[#ff4444] hover:bg-[#ff4444]/10
              transition-colors
              ${sidebarCollapsed ? 'justify-center px-2 py-3' : 'gap-3 px-4 py-3 flex-1'}
            `}
            title={sidebarCollapsed ? t('logout') : undefined}
          >
            <LogOut className="w-5 h-5 shrink-0" />
            {!sidebarCollapsed && <span className="text-sm">{t('logout')}</span>}
          </button>
        </div>
      </div>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </aside>
  );
}
