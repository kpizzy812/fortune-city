import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { Toaster } from 'sonner';
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#1a0a2e] text-white min-h-screen`}
      >
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
      </body>
    </html>
  );
}
