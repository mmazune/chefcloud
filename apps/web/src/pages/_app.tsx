import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { AuthProvider } from '@/contexts/AuthContext';
import { ActiveBranchProvider } from '@/contexts/ActiveBranchContext';
import { DevDebugPanel } from '@/components/dev/DevDebugPanel';
import { useState } from 'react';
import { useRouter } from 'next/router';
import { AppErrorBoundary, type ErrorBoundaryContext } from '@/components/common/AppErrorBoundary';
import { SkipToContentLink } from '@/components/common/SkipToContentLink';
import { SessionIdleManager } from '@/components/auth/SessionIdleManager';
import { initNavmapCollector, useNavmapCapture } from '@/lib/navmap';
import { DevNavmapPanel } from '@/components/dev/DevNavmapPanel';

// Phase I3: Initialize navmap collector on client side
if (typeof window !== 'undefined') {
  initNavmapCollector();
}

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const pathname = router.pathname || '';
  
  // Phase I3: Capture navigation actions when enabled
  useNavmapCapture();
  
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes - reduced refetching for better performance
            refetchOnWindowFocus: false,
            retry: 1, // Reduce retries for faster failures
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
          <ActiveBranchProvider>
            {/* M31-A11Y-S2: Global skip link for keyboard navigation */}
            <SkipToContentLink />
            {/* M32-SEC-S1: Global idle session timeout */}
            <SessionIdleManager>
              <Component {...pageProps} />
            </SessionIdleManager>
            {/* V2.1.1: Developer debug panel */}
            <DevDebugPanel />
            {/* Phase I3: Navmap capture panel */}
            <DevNavmapPanel />
            {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
          </ActiveBranchProvider>
        </AuthProvider>
      </QueryClientProvider>
    </AppErrorBoundary>
  );
}
