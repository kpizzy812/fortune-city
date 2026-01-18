'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useAuthStore } from '@/stores/auth.store';
import { useFortuneRateStore } from '@/stores/fortune-rate.store';
import { ProfileModal } from '@/components/profile/ProfileModal';
import { formatUserDisplayName, getUserInitial } from '@/lib/utils';

export function MobileHeader() {
  const { user } = useAuthStore();
  const { usdToFortune, isRateAvailable } = useFortuneRateStore();
  const tBrand = useTranslations('brand');
  const tProfile = useTranslations('profile');
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  if (!user) return null;

  const displayName = formatUserDisplayName(user);
  const userInitial = getUserInitial(user);
  const balance = parseFloat(user.fortuneBalance);

  return (
    <>
      <header className="lg:hidden sticky top-0 z-40 bg-[#1a0a2e]/95 backdrop-blur-lg border-b border-[#ff2d95]/20">
        <div className="flex items-center justify-between px-4 py-3">
          {/* Logo */}
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-[#ff2d95] to-[#00d4ff] bg-clip-text text-transparent">
              {tBrand('name')}
            </h1>
          </div>

          {/* User Info */}
          <div className="flex items-center gap-3">
            {/* Balance */}
            <div className="text-right">
              <p className="text-sm text-[#ffd700] font-mono font-bold">
                ${balance.toFixed(2)}
              </p>
              {isRateAvailable() && (
                <p className="text-[10px] text-[#b0b0b0]">
                  {Math.floor(usdToFortune(balance) ?? 0).toLocaleString()} $FORTUNE
                </p>
              )}
            </div>

            {/* Avatar */}
            <button
              onClick={() => setIsProfileOpen(true)}
              className="
                w-10 h-10 rounded-full
                bg-gradient-to-br from-[#ff2d95] to-[#00d4ff]
                flex items-center justify-center font-bold text-sm text-white
                hover:shadow-[0_0_15px_rgba(255,45,149,0.5)] transition-shadow
              "
              title={tProfile('title')}
            >
              {userInitial}
            </button>
          </div>
        </div>
      </header>

      {/* Profile Modal */}
      <ProfileModal isOpen={isProfileOpen} onClose={() => setIsProfileOpen(false)} />
    </>
  );
}
