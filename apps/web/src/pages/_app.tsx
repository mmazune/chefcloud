import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { AppErrorBoundary, type ErrorBoundaryContext } from '@/components/common/AppErrorBoundary';
import { SkipToContentLink } from '@/components/common/SkipToContentLink';
import { SessionIdleManager } from '@/components/auth/SessionIdleManager';

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const pathname = router.pathname || '';
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000, // 1 minute
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  let context: ErrorBoundaryContext = 'APP';
  if (pathname.startsWith('/pos')) context = 'POS';
  else if (pathname.startsWith('/kds')) context = 'KDS';

  return (
    <AppErrorBoundary context={context}>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          {/* M31-A11Y-S2: Global skip link for keyboard navigation */}
          <SkipToContentLink />
          {/* M32-SEC-S1: Global idle session timeout */}
          <SessionIdleManager>
            <Component {...pageProps} />
          </SessionIdleManager>
          {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
