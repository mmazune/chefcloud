import React, { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import {
  AuthUser,
  getCurrentUser,
  isAuthenticated,
  login as authLogin,
  logout as authLogout,
  pinLogin as authPinLogin,
  LoginCredentials,
  PinLoginCredentials,
} from '@/lib/auth';
import { getDefaultRouteForRole, canAccessRoute } from '@/config/roleCapabilities';

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: (credentials: LoginCredentials) => Promise<void>;
  pinLogin: (credentials: PinLoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refetchUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Determine the post-login route for a user.
 * 
 * Logic:
 * 1. If explicit redirect is provided and accessible, use it
 * 2. Otherwise use role's default route (with fallback)
 * 3. Prevent redirecting to login or already-on routes
 */
function getPostLoginRoute(
  jobRole: string | undefined,
  explicitRedirect: string | undefined,
  currentPath: string
): string {
  // If explicit redirect provided, validate it
  if (explicitRedirect && explicitRedirect !== '/login') {
    if (canAccessRoute(jobRole, explicitRedirect)) {
      return explicitRedirect;
    }
    // Explicit redirect not accessible, fall through to default
  }
  
  // Get default route with validation and fallback
  const result = getDefaultRouteForRole(jobRole);
  
  // Prevent loop: if already on default route, don't redirect
  if (result.route === currentPath) {
    return currentPath;
  }
  
  return result.route;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fetchUser = async () => {
    if (!isAuthenticated()) {
      setLoading(false);
      return;
    }

    try {
      const userData = await getCurrentUser();
      setUser(userData);
      setError(null);
    } catch (err: any) {
      console.error('Failed to fetch user:', err);
      setError(err.message);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (credentials: LoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      const userData = await authLogin(credentials);
      setUser(userData);
      
      // Small delay to ensure cookie is fully set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // M8.1/Prompt5: Role-based post-login routing with validation
      const explicitRedirect = router.query.redirect as string;
      const targetRoute = getPostLoginRoute(
        userData.jobRole,
        explicitRedirect,
        router.pathname
      );
      router.push(targetRoute);
    } catch (err: any) {
      setError(err.message || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const pinLogin = async (credentials: PinLoginCredentials) => {
    try {
      setLoading(true);
      setError(null);
      const userData = await authPinLogin(credentials);
      setUser(userData);
      
      // Small delay to ensure cookie is fully set before navigation
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // M8.1/Prompt5: Role-based post-login routing with validation
      const explicitRedirect = router.query.redirect as string;
      const targetRoute = getPostLoginRoute(
        userData.jobRole,
        explicitRedirect,
        router.pathname
      );
      router.push(targetRoute);
    } catch (err: any) {
      setError(err.message || 'PIN login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authLogout();
      setUser(null);
      router.push('/login');
    } catch (err: any) {
      console.error('Logout error:', err);
    }
  };

  const refetchUser = async () => {
    await fetchUser();
  };

  return (
    <AuthContext.Provider
      value={{ user, loading, error, login, pinLogin, logout, refetchUser }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
