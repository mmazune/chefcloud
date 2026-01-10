/**
 * Test Utilities for ChefCloud Web App
 * 
 * Provides a canonical renderWithProviders function that wraps components
 * with all the providers they would have in the real app:
 * - QueryClientProvider (React Query)
 * - AuthProvider (authentication context) - mocked
 * - ActiveBranchProvider (branch context) - mocked
 * 
 * @see docs/quality/WEB_TESTING_HARNESS.md for usage documentation
 */
import React, { ReactElement, PropsWithChildren } from 'react';
import { render, RenderOptions, RenderResult } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { AuthUser } from '@/lib/auth';

// ============================================================================
// Mock Types
// ============================================================================

export interface MockAuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  error: string | null;
  login: jest.Mock;
  pinLogin: jest.Mock;
  logout: jest.Mock;
  refetchUser: jest.Mock;
}

export interface MockBranchContextValue {
  activeBranchId: string | null;
  activeBranch: { id: string; name: string } | null;
  branches: { id: string; name: string }[];
  isMultiBranch: boolean;
  isLoading: boolean;
  setActiveBranchId: jest.Mock;
}

export interface RenderWithProvidersOptions extends Omit<RenderOptions, 'wrapper'> {
  /** Mock auth context values - defaults to logged-in OWNER */
  auth?: Partial<MockAuthContextValue>;
  /** Mock branch context values - defaults to single branch */
  branch?: Partial<MockBranchContextValue>;
  /** Provide a pre-configured QueryClient for specific test scenarios */
  queryClient?: QueryClient;
}

// ============================================================================
// Default Mock Values
// ============================================================================

export const createMockUser = (overrides?: Partial<AuthUser>): AuthUser => ({
  id: 'test-user-1',
  email: 'owner@demo.com',
  displayName: 'Test Owner',
  roleLevel: 'L5' as any, // OWNER level
  jobRole: 'OWNER',
  org: { id: 'org-1', name: 'Test Org' },
  branch: { id: 'branch-1', name: 'Main Branch' },
  ...overrides,
});

export const createMockAuthContext = (overrides?: Partial<MockAuthContextValue>): MockAuthContextValue => ({
  user: createMockUser(overrides?.user as Partial<AuthUser> | undefined),
  loading: false,
  error: null,
  login: jest.fn(),
  pinLogin: jest.fn(),
  logout: jest.fn(),
  refetchUser: jest.fn(),
  ...overrides,
});

export const createMockBranchContext = (overrides?: Partial<MockBranchContextValue>): MockBranchContextValue => ({
  activeBranchId: 'branch-1',
  activeBranch: { id: 'branch-1', name: 'Main Branch' },
  branches: [{ id: 'branch-1', name: 'Main Branch' }],
  isMultiBranch: false,
  isLoading: false,
  setActiveBranchId: jest.fn(),
  ...overrides,
});

// ============================================================================
// React Contexts (mirroring actual app contexts for test use)
// ============================================================================

const MockAuthContext = React.createContext<MockAuthContextValue | undefined>(undefined);
const MockBranchContext = React.createContext<MockBranchContextValue | undefined>(undefined);

// Custom hook replacements that read from mock contexts
export const MockAuthProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MockAuthContextValue;
}) => (
  <MockAuthContext.Provider value={value}>{children}</MockAuthContext.Provider>
);

export const MockBranchProvider = ({
  children,
  value,
}: {
  children: React.ReactNode;
  value: MockBranchContextValue;
}) => (
  <MockBranchContext.Provider value={value}>{children}</MockBranchContext.Provider>
);

// ============================================================================
// Create Test QueryClient
// ============================================================================

export const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        gcTime: 0,
        staleTime: 0,
      },
      mutations: {
        retry: false,
      },
    },
  });

// ============================================================================
// All Providers Wrapper
// ============================================================================

interface AllProvidersProps extends PropsWithChildren {
  authValue: MockAuthContextValue;
  branchValue: MockBranchContextValue;
  queryClient: QueryClient;
}

const AllProviders = ({ children, authValue, branchValue, queryClient }: AllProvidersProps) => (
  <QueryClientProvider client={queryClient}>
    <MockAuthProvider value={authValue}>
      <MockBranchProvider value={branchValue}>{children}</MockBranchProvider>
    </MockAuthProvider>
  </QueryClientProvider>
);

// ============================================================================
// renderWithProviders
// ============================================================================

/**
 * Render a component with all necessary providers for testing.
 * 
 * @example
 * // Basic usage with defaults
 * const { getByText } = renderWithProviders(<MyComponent />);
 * 
 * @example
 * // With custom auth state
 * renderWithProviders(<ProtectedPage />, {
 *   auth: { user: createMockUser({ jobRole: 'CASHIER' }) }
 * });
 * 
 * @example
 * // With loading state
 * renderWithProviders(<LoadingComponent />, {
 *   auth: { loading: true, user: null }
 * });
 */
export function renderWithProviders(
  ui: ReactElement,
  options: RenderWithProvidersOptions = {}
): RenderResult & {
  queryClient: QueryClient;
  authValue: MockAuthContextValue;
  branchValue: MockBranchContextValue;
} {
  const { auth, branch, queryClient: providedQueryClient, ...renderOptions } = options;

  const queryClient = providedQueryClient ?? createTestQueryClient();
  const authValue = createMockAuthContext(auth);
  const branchValue = createMockBranchContext(branch);

  const Wrapper = ({ children }: PropsWithChildren) => (
    <AllProviders authValue={authValue} branchValue={branchValue} queryClient={queryClient}>
      {children}
    </AllProviders>
  );

  const result = render(ui, { wrapper: Wrapper, ...renderOptions });

  return {
    ...result,
    queryClient,
    authValue,
    branchValue,
  };
}

// ============================================================================
// Re-exports from testing-library
// ============================================================================

export * from '@testing-library/react';
export { renderWithProviders as render };
