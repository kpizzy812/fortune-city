'use client';

import { useLocale } from 'next-intl';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { locales, localeNames, localeFlags, type Locale } from '@/i18n/config';

interface LanguageSwitcherProps {
  collapsed?: boolean;
}

export function LanguageSwitcher({ collapsed = false }: LanguageSwitcherProps) {
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
        flex items-center justify-center
        rounded-lg text-[#b0b0b0]
        bg-[#2a1a4e]/30 hover:bg-[#2a1a4e] hover:text-white
        transition-colors
        ${collapsed ? 'w-10 h-10' : 'px-3 py-2'}
        ${isPending ? 'opacity-50' : ''}
      `}
      title={`${localeNames[locale]} → ${localeNames[nextLocale]}`}
    >
      <span className="text-xl">{localeFlags[locale]}</span>
    </button>
  );
}
