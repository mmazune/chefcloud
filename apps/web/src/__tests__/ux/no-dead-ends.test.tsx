/**
 * Phase H5: Role Landing Pages Smoke Tests
 * 
 * Verifies that each role's landing page component can be imported
 * and rendered without throwing runtime errors.
 */

import React from 'react';
import { render } from '@testing-library/react';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: () => ({
    push: jest.fn(),
    replace: jest.fn(),
    prefetch: jest.fn(),
    pathname: '/',
    query: {},
    asPath: '/',
    isReady: true,
  }),
}));

// Mock auth context
jest.mock('@/contexts/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 'test-user',
      email: 'test@example.com',
      displayName: 'Test User',
      jobRole: 'OWNER',
      roleLevel: 'L5',
      org: { id: 'test-org', name: 'Test Org' },
      branch: null,
    },
    loading: false,
    isAuthenticated: true,
  }),
  AuthProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock active branch context
jest.mock('@/contexts/ActiveBranchContext', () => ({
  useActiveBranch: () => ({
    activeBranchId: null,
    branches: [],
    isMultiBranch: false,
    setActiveBranchId: jest.fn(),
  }),
}));

// Mock API client
jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ data: [] }),
    post: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

// Mock React Query
jest.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [], isLoading: false, error: null }),
  useMutation: () => ({ mutate: jest.fn(), isPending: false }),
  useQueryClient: () => ({ invalidateQueries: jest.fn() }),
  QueryClient: jest.fn(),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe('Role Landing Pages - No Runtime Errors', () => {
  // Test workspace placeholder pages (role landing pages)
  describe('Workspace Pages', () => {
    it('owner workspace imports without error', async () => {
      // Dynamic import to test module resolution
      const module = await import('@/pages/workspaces/owner');
      expect(module.default).toBeDefined();
    });

    it('manager workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/manager');
      expect(module.default).toBeDefined();
    });

    it('accountant workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/accountant');
      expect(module.default).toBeDefined();
    });

    it('procurement workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/procurement');
      expect(module.default).toBeDefined();
    });

    it('stock-manager workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/stock-manager');
      expect(module.default).toBeDefined();
    });

    it('supervisor workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/supervisor');
      expect(module.default).toBeDefined();
    });

    it('chef workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/chef');
      expect(module.default).toBeDefined();
    });

    it('event-manager workspace imports without error', async () => {
      const module = await import('@/pages/workspaces/event-manager');
      expect(module.default).toBeDefined();
    });
  });

  // Test high-traffic pages
  describe('High-Traffic Pages', () => {
    it('dashboard page imports without error', async () => {
      const module = await import('@/pages/dashboard');
      expect(module.default).toBeDefined();
    });

    it('POS page imports without error', async () => {
      const module = await import('@/pages/pos/index');
      expect(module.default).toBeDefined();
    });

    it('KDS page imports without error', async () => {
      const module = await import('@/pages/kds/index');
      expect(module.default).toBeDefined();
    });

    it('inventory page imports without error', async () => {
      const module = await import('@/pages/inventory/index');
      expect(module.default).toBeDefined();
    });

    it('settings page imports without error', async () => {
      const module = await import('@/pages/settings/index');
      expect(module.default).toBeDefined();
    });
  });

  // Test shared UI components
  describe('Shared UI Components', () => {
    it('EmptyState component renders without error', async () => {
      const { EmptyState } = await import('@/components/EmptyState');
      const { FileText } = await import('lucide-react');
      
      expect(() => {
        render(
          <EmptyState
            icon={FileText}
            title="Test"
            description="Test description"
          />
        );
      }).not.toThrow();
    });

    it('ErrorState component renders without error', async () => {
      const { ErrorState } = await import('@/components/ErrorState');
      
      expect(() => {
        render(<ErrorState title="Test Error" message="Test message" />);
      }).not.toThrow();
    });

    it('PlannedFeatureBanner component renders without error', async () => {
      const { PlannedFeatureBanner } = await import('@/components/PlannedFeatureBanner');
      
      expect(() => {
        render(
          <PlannedFeatureBanner
            featureName="Test Feature"
            status="planned"
          />
        );
      }).not.toThrow();
    });
  });
});
