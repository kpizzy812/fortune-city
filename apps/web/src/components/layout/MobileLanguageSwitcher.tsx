'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { locales, localeFlags, localeNames, type Locale } from '@/i18n/config';

export function MobileLanguageSwitcher() {
  const locale = useLocale() as Locale;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const currentIndex = locales.indexOf(locale);
  const nextLocale = locales[(currentIndex + 1) % locales.length];

  const handleLocaleChange = () => {
    document.cookie = `NEXT_LOCALE=${nextLocale};path=/;max-age=${60 * 60 * 24 * 365}`;
    startTransition(() => {
      router.refresh();
    });
  };

  return (
    <button
      onClick={handleLocaleChange}
      disabled={isPending}
      className={`
        fixed top-4 right-14 z-50
        lg:hidden
        w-10 h-10 rounded-full
        bg-[#2a1a4e]/90 backdrop-blur-sm
        border border-[#ff2d95]/30
        flex items-center justify-center
        text-xl
        shadow-lg shadow-black/20
        transition-all
        hover:border-[#ff2d95] hover:scale-105
        active:scale-95
        ${isPending ? 'opacity-50' : ''}
      `}
      title={`${localeNames[locale]} → ${localeNames[nextLocale]}`}
    >
      {localeFlags[locale]}
    </button>
  );
}
