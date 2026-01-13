import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isValidLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  // Priority for locale detection:
  // 1. Cookie (user's explicit choice)
  // 2. Accept-Language header (browser preference)
  // 3. Default locale

  let locale: Locale = defaultLocale;

  // Try to get locale from cookie
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    // Try to get from Accept-Language header
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    if (acceptLanguage) {
      // Parse accept-language header (e.g., "en-US,en;q=0.9,ru;q=0.8")
      const preferredLocales = acceptLanguage
        .split(',')
        .map((lang) => {
          const [code] = lang.trim().split(';');
          return code.split('-')[0]; // Get language code without region
        });

      for (const preferredLocale of preferredLocales) {
        if (isValidLocale(preferredLocale)) {
          locale = preferredLocale;
          break;
        }
      }
    }
  }

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
