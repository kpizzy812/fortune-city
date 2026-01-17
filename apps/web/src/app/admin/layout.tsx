'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAdminAuthStore } from '@/stores/admin/admin-auth.store';
import { AdminSidebar } from '@/components/admin/layout/AdminSidebar';
import { AdminHeader } from '@/components/admin/layout/AdminHeader';

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const { token, checkSession } = useAdminAuthStore();
  const [isChecking, setIsChecking] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const isLoginPage = pathname === '/admin/login';

  useEffect(() => {
    const verifySession = async () => {
      if (isLoginPage) {
        // On login page, redirect to dashboard if already logged in
        if (token) {
          const isValid = await checkSession();
          if (isValid) {
            router.replace('/admin/dashboard');
            return;
          }
        }
        setIsChecking(false);
        return;
      }

      // On protected pages, verify token
      if (!token) {
        router.replace('/admin/login');
        return;
      }

      const isValid = await checkSession();
      if (!isValid) {
        router.replace('/admin/login');
        return;
      }

      setIsChecking(false);
    };

    verifySession();
  }, [token, isLoginPage, checkSession, router]);

  // Show loading state while checking
  if (isChecking && !isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-amber-500" />
      </div>
    );
  }

  // Login page - no sidebar/header
  if (isLoginPage) {
    return (
      <div className="min-h-screen bg-slate-950">
        {children}
      </div>
    );
  }

  // Protected pages - with sidebar/header
  return (
    <div className="min-h-screen bg-slate-950">
      {/* Sidebar */}
      <AdminSidebar />

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="lg:pl-64">
        <AdminHeader onMenuClick={() => setMobileMenuOpen(true)} />
        <main className="p-4 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
