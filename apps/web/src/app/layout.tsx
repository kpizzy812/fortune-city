import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import Script from 'next/script';
import { Toaster } from 'sonner';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import './globals.css';
import { TelegramProvider } from '@/providers/TelegramProvider';
import { AuthenticatedLayout } from '@/components/layout/AuthenticatedLayout';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Fortune City',
  description: 'Spin your fortune. Own the floor.',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover' as const,
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html lang={locale} className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#1a0a2e] text-white min-h-screen`}
      >
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        <NextIntlClientProvider messages={messages}>
          <TelegramProvider>
            <AuthenticatedLayout>{children}</AuthenticatedLayout>
          </TelegramProvider>
          <Toaster
            position="top-center"
            toastOptions={{
              style: {
                background: '#2a1a4e',
                border: '1px solid rgba(255, 45, 149, 0.3)',
                color: '#ffffff',
              },
              className: 'font-sans',
            }}
            theme="dark"
            richColors
          />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
