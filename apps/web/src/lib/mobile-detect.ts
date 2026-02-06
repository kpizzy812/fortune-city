/**
 * Утилиты для определения мобильного устройства и генерации Phantom deep links.
 *
 * На мобильных устройствах browser extension Phantom недоступен,
 * поэтому вместо WalletMultiButton показываем кнопку "Open in Phantom",
 * которая открывает текущую страницу в in-app browser Phantom,
 * где window.solana инжектируется автоматически.
 */

export function isMobileBrowser(): boolean {
  if (typeof window === 'undefined') return false;
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent,
  );
}

export function isSolanaProviderAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!window.solana || !!window.phantom?.solana;
}

/** Мобильное устройство без wallet provider — нужен redirect в Phantom */
export function needsPhantomRedirect(): boolean {
  return isMobileBrowser() && !isSolanaProviderAvailable();
}

/** Генерирует Phantom universal link для открытия URL в in-app browser */
export function getPhantomBrowseUrl(url?: string): string {
  const targetUrl = url ?? window.location.href;
  return `https://phantom.app/ul/browse/${encodeURIComponent(targetUrl)}?ref=${encodeURIComponent(window.location.origin)}`;
}

/** Открывает текущую страницу в Phantom in-app browser */
export function openInPhantom(url?: string): void {
  window.location.href = getPhantomBrowseUrl(url);
}
