import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/router';
import { LoginCredentials, PinLoginCredentials } from '@/lib/auth';

export default function LoginPage() {
  const { login, pinLogin, loading, error: authError } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'email' | 'pin'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    try {
      const credentials: LoginCredentials = { email, password };
      await login(credentials);
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed. Please check your credentials.');
    }
  };

  const handlePinLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!pin || pin.length < 4) {
      setError('Please enter a valid PIN (at least 4 digits)');
      return;
    }

    try {
      const credentials: PinLoginCredentials = { pin };
      await pinLogin(credentials);
    } catch (err: any) {
      setError(err.response?.data?.message || 'PIN login failed. Please check your PIN.');
    }
  };

  // If already authenticated, redirect to dashboard
  React.useEffect(() => {
    if (router.query.redirect && typeof window !== 'undefined') {
      // User came from a protected page, stay on login
      return;
    }
  }, [router.query]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-chefcloud-navy via-chefcloud-blue to-chefcloud-lavender p-4">
      <div className="w-full max-w-md">
        <div className="rounded-lg bg-white p-8 shadow-2xl">
          {/* Logo and Title */}
          <div className="mb-8 text-center">
            <h1 className="mb-2 text-3xl font-bold text-chefcloud-navy">ChefCloud</h1>
            <p className="text-muted-foreground">Enterprise POS for Uganda</p>
          </div>

          {/* Tab Switcher */}
          <div className="mb-6 flex gap-2 rounded-lg bg-gray-100 p-1">
            <button
              onClick={() => setActiveTab('email')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'email'
                  ? 'bg-white text-chefcloud-navy shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Email / Password
            </button>
            <button
              onClick={() => setActiveTab('pin')}
              className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === 'pin'
                  ? 'bg-white text-chefcloud-navy shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              PIN Login
            </button>
          </div>

          {/* Error Message */}
          {(error || authError) && (
            <div className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-600">
              {error || authError}
            </div>
          )}

          {/* Email/Password Form */}
          {activeTab === 'email' && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div>
                <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
                  Email
                </label>
                <input
                  type="email"
                  id="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-chefcloud-blue focus:outline-none focus:ring-2 focus:ring-chefcloud-blue/20"
                  placeholder="you@example.com"
                  disabled={loading}
                  autoComplete="email"
                />
              </div>

              <div>
                <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
                  Password
                </label>
                <input
                  type="password"
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:border-chefcloud-blue focus:outline-none focus:ring-2 focus:ring-chefcloud-blue/20"
                  placeholder="••••••••"
                  disabled={loading}
                  autoComplete="current-password"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-chefcloud-blue px-4 py-2 font-medium text-white transition-colors hover:bg-chefcloud-navy disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* PIN Login Form */}
          {activeTab === 'pin' && (
            <form onSubmit={handlePinLogin} className="space-y-4">
              <div>
                <label htmlFor="pin" className="mb-1 block text-sm font-medium text-gray-700">
                  PIN
                </label>
                <input
                  type="password"
                  id="pin"
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-center text-2xl tracking-widest focus:border-chefcloud-blue focus:outline-none focus:ring-2 focus:ring-chefcloud-blue/20"
                  placeholder="••••"
                  disabled={loading}
                  maxLength={6}
                  autoComplete="off"
                />
                <p className="mt-1 text-xs text-gray-500">
                  Enter your 4-6 digit PIN for fast login
                </p>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-md bg-chefcloud-blue px-4 py-2 font-medium text-white transition-colors hover:bg-chefcloud-navy disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'Logging in...' : 'Sign In with PIN'}
              </button>
            </form>
          )}

          {/* Footer */}
          <div className="mt-6 text-center text-xs text-gray-500">
            <p>ChefCloud Web Backoffice</p>
            <p className="mt-1">For managers and owners</p>
          </div>
        </div>

        {/* Dev Note */}
        {process.env.NEXT_PUBLIC_APP_ENV === 'development' && (
          <div className="mt-4 rounded-md bg-yellow-50 p-3 text-xs text-yellow-800">
            <strong>Dev Mode:</strong> Use test credentials from backend seed data
          </div>
        )}
      </div>
    </div>
  );
}
