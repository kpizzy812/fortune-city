'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Eye, EyeOff, Lock, User, AlertCircle } from 'lucide-react';
import { useAdminAuthStore } from '@/stores/admin/admin-auth.store';

export default function AdminLoginPage() {
  const router = useRouter();
  const { login, isLoading, error } = useAdminAuthStore();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!username.trim() || !password.trim()) {
      setLocalError('Please enter username and password');
      return;
    }

    try {
      await login(username.trim(), password, rememberMe);
      router.replace('/admin/dashboard');
    } catch {
      // Error is already set in store
    }
  };

  const displayError = localError || error;

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 mb-4">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">
            Fortune City
          </h1>
          <p className="text-slate-400 mt-1">
            Admin Panel
          </p>
        </div>

        {/* Login Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-900 rounded-2xl border border-slate-700 p-6 space-y-5"
        >
          <div className="text-center mb-6">
            <h2 className="text-lg font-semibold text-white">
              Sign In
            </h2>
            <p className="text-sm text-slate-400 mt-1">
              Enter your credentials to access the admin panel
            </p>
          </div>

          {/* Error Alert */}
          {displayError && (
            <div className="flex items-center gap-3 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{displayError}</p>
            </div>
          )}

          {/* Username */}
          <div className="space-y-2">
            <label htmlFor="username" className="block text-sm font-medium text-slate-300">
              Username
            </label>
            <div className="relative">
              <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="
                  w-full pl-10 pr-4 py-3
                  bg-slate-800 border border-slate-600
                  rounded-lg text-white
                  placeholder:text-slate-500
                  focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500
                  transition-colors
                "
                placeholder="Enter username"
                autoComplete="username"
                disabled={isLoading}
              />
            </div>
          </div>

          {/* Password */}
          <div className="space-y-2">
            <label htmlFor="password" className="block text-sm font-medium text-slate-300">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="
                  w-full pl-10 pr-12 py-3
                  bg-slate-800 border border-slate-600
                  rounded-lg text-white
                  placeholder:text-slate-500
                  focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500
                  transition-colors
                "
                placeholder="Enter password"
                autoComplete="current-password"
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white transition-colors"
              >
                {showPassword ? (
                  <EyeOff className="w-5 h-5" />
                ) : (
                  <Eye className="w-5 h-5" />
                )}
              </button>
            </div>
          </div>

          {/* Remember Me */}
          <div className="flex items-center">
            <input
              id="rememberMe"
              type="checkbox"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="
                w-4 h-4 rounded
                bg-slate-800 border-slate-600
                text-amber-500
                focus:ring-2 focus:ring-amber-500 focus:ring-offset-0
                transition-colors
              "
              disabled={isLoading}
            />
            <label
              htmlFor="rememberMe"
              className="ml-2 text-sm text-slate-300 cursor-pointer select-none"
            >
              Remember me for 30 days
            </label>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isLoading}
            className="
              w-full py-3 rounded-lg
              bg-gradient-to-r from-amber-500 to-orange-600
              text-white font-semibold
              hover:from-amber-600 hover:to-orange-700
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              flex items-center justify-center gap-2
            "
          >
            {isLoading ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-white/30 border-t-white" />
                <span>Signing in...</span>
              </>
            ) : (
              <span>Sign In</span>
            )}
          </button>
        </form>

        {/* Footer */}
        <p className="text-center text-slate-500 text-sm mt-6">
          Protected area. Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
