'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

/**
 * Shows Telegram BackButton on non-root pages and navigates back on click.
 * On root pages (bottom nav destinations) the button is hidden.
 */
const ROOT_PATHS = ['/', '/app', '/app/shop', '/app/wheel', '/app/refs', '/app/cash'];

export function useTelegramBackButton() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const backButton = window.Telegram?.WebApp?.BackButton;
    if (!backButton) return;

    const isRoot = ROOT_PATHS.includes(pathname);

    if (isRoot) {
      backButton.hide();
      return;
    }

    backButton.show();

    const handleBack = () => {
      router.back();
    };

    backButton.onClick(handleBack);

    return () => {
      backButton.offClick(handleBack);
    };
  }, [pathname, router]);
}
