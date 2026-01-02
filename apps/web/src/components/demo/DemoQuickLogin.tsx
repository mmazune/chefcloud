/**
 * Demo Quick Login Panel
 * Milestone 6: ChefCloud V2 UX Upgrade
 * 
 * Provides quick login buttons for demo accounts (Tapas/Cafesserie)
 * without exposing secrets beyond the known Demo#123 password.
 */

import React, { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cn } from '@/lib/utils';
import { Building2, ChefHat, Loader2, Sparkles } from 'lucide-react';

interface DemoAccount {
  name: string;
  email: string;
  org: string;
  role: string;
  icon: React.ReactNode;
  color: string;
  bgColor: string;
}

const DEMO_PASSWORD = 'Demo#123';

const DEMO_ACCOUNTS: DemoAccount[] = [
  {
    name: 'Tapas Owner',
    email: 'owner@tapas.demo.local',
    org: 'Tapas Bar & Restaurant',
    role: 'Owner (L5)',
    icon: <ChefHat className="h-5 w-5" />,
    color: 'text-orange-600',
    bgColor: 'bg-orange-50 hover:bg-orange-100 border-orange-200',
  },
  {
    name: 'Cafesserie Manager',
    email: 'manager@cafesserie.demo.local',
    org: 'Cafesserie (4 branches)',
    role: 'Manager (L4)',
    icon: <Building2 className="h-5 w-5" />,
    color: 'text-blue-600',
    bgColor: 'bg-blue-50 hover:bg-blue-100 border-blue-200',
  },
];

interface DemoQuickLoginProps {
  onLoginStart?: () => void;
  onLoginSuccess?: () => void;
  onLoginError?: (error: string) => void;
  onSelectCredentials?: (email: string, password: string) => void;
  className?: string;
  compact?: boolean;
}

export function DemoQuickLogin({
  onLoginStart,
  onLoginSuccess,
  onLoginError,
  className,
  compact = false,
}: DemoQuickLoginProps) {
  const { login } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDemoLogin = async (account: DemoAccount) => {
    setLoading(account.email);
    setError(null);
    onLoginStart?.();

    try {
      await login({
        email: account.email,
        password: DEMO_PASSWORD,
      });
      onLoginSuccess?.();
    } catch (err: any) {
      const errorMsg = err.response?.data?.message || 'Demo login failed';
      setError(errorMsg);
      onLoginError?.(errorMsg);
    } finally {
      setLoading(null);
    }
  };

  if (compact) {
    return (
      <div className={cn('flex gap-2', className)}>
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            onClick={() => handleDemoLogin(account)}
            disabled={loading !== null}
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-all',
              account.bgColor,
              account.color,
              loading === account.email && 'opacity-70'
            )}
          >
            {loading === account.email ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              account.icon
            )}
            {account.name}
          </button>
        ))}
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border bg-gradient-to-br from-white to-gray-50 p-6', className)}>
      <div className="flex items-center gap-2 mb-4">
        <div className="p-2 rounded-lg bg-gradient-to-r from-chefcloud-blue to-purple-500">
          <Sparkles className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900">Demo Quick Access</h3>
          <p className="text-xs text-muted-foreground">Try ChefCloud with sample data</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      <div className="space-y-3">
        {DEMO_ACCOUNTS.map((account) => (
          <button
            key={account.email}
            onClick={() => handleDemoLogin(account)}
            disabled={loading !== null}
            className={cn(
              'w-full flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all',
              account.bgColor,
              loading === account.email && 'opacity-70 cursor-wait'
            )}
          >
            <div className={cn('p-3 rounded-lg', account.color, 'bg-white/80')}>
              {loading === account.email ? (
                <Loader2 className="h-6 w-6 animate-spin" />
              ) : (
                account.icon
              )}
            </div>
            <div className="flex-1">
              <div className={cn('font-semibold', account.color)}>{account.name}</div>
              <div className="text-sm text-gray-600">{account.org}</div>
              <div className="text-xs text-muted-foreground">{account.role}</div>
            </div>
            <div className="text-xs text-muted-foreground px-2 py-1 bg-white/60 rounded">
              {loading === account.email ? 'Signing in...' : 'Click to login'}
            </div>
          </button>
        ))}
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-muted-foreground text-center">
          Demo accounts use password <code className="px-1 py-0.5 bg-gray-100 rounded">Demo#123</code>
        </p>
      </div>
    </div>
  );
}

/**
 * Autofill helper - fills email/password inputs without submitting
 * For use when you want to show credentials in form first
 */
export function useDemoAutofill() {
  const autofillTapas = (
    setEmail: (v: string) => void,
    setPassword: (v: string) => void
  ) => {
    setEmail('owner@tapas.demo.local');
    setPassword(DEMO_PASSWORD);
  };

  const autofillCafesserie = (
    setEmail: (v: string) => void,
    setPassword: (v: string) => void
  ) => {
    setEmail('manager@cafesserie.demo.local');
    setPassword(DEMO_PASSWORD);
  };

  return { autofillTapas, autofillCafesserie, DEMO_PASSWORD };
}
