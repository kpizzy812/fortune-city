import { getRequestConfig } from 'next-intl/server';
import { cookies, headers } from 'next/headers';
import { defaultLocale, isValidLocale, type Locale } from './config';

export default getRequestConfig(async () => {
  // Priority: 1. Cookie (user choice) → 2. Accept-Language → 3. Default (en)

  let locale: Locale = defaultLocale;

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get('NEXT_LOCALE')?.value;
  if (cookieLocale && isValidLocale(cookieLocale)) {
    locale = cookieLocale;
  } else {
    const headersList = await headers();
    const acceptLanguage = headersList.get('accept-language');
    if (acceptLanguage) {
      const preferredLocales = acceptLanguage
        .split(',')
        .map((lang) => {
          const [code] = lang.trim().split(';');
          return code.split('-')[0];
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
