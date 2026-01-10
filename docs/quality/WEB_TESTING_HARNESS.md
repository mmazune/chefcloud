# Web Testing Harness

> Phase H7 — PRE-012 Resolution | Updated: 2026-01-10

---

## Overview

This document describes the test infrastructure for `apps/web` component tests.

## Test Stack

| Component | Tool | Notes |
|-----------|------|-------|
| Test Runner | Jest | Configured via `jest.config.ts` |
| Test Environment | jsdom | DOM simulation for React components |
| Testing Library | @testing-library/react | Component testing utilities |
| Mocking | Jest mocks | Global setup in `jest.setup.ts` |

---

## Global Mocks (`jest.setup.ts`)

The following are mocked globally for all tests:

### Browser APIs
- `window.matchMedia` — Returns mock media query list
- `ResizeObserver` — Mock implementation
- `IntersectionObserver` — Mock implementation
- `crypto.randomUUID` — UUID v4 generator for tests
- `localStorage` — In-memory storage mock
- `fetch` — Returns empty successful response

### Next.js Router
```typescript
jest.mock('next/router', () => ({
  useRouter: jest.fn().mockReturnValue({
    pathname: '/',
    query: {},
    push: jest.fn(),
    replace: jest.fn(),
    // ... full router mock
  }),
}));

jest.mock('next/navigation', () => ({
  useRouter: jest.fn(),
  usePathname: jest.fn().mockReturnValue('/'),
  useSearchParams: jest.fn().mockReturnValue(new URLSearchParams()),
}));
```

### Auth Context
```typescript
jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }) => children,
  useAuth: jest.fn().mockReturnValue({
    user: {
      id: 'test-user-1',
      email: 'owner@demo.com',
      name: 'Test Owner',
      jobRole: 'OWNER',
      org: { id: 'org-1', name: 'Test Org' },
      branch: { id: 'branch-1', name: 'Main Branch' },
      permissions: ['*'],
    },
    loading: false,
    error: null,
    login: jest.fn(),
    logout: jest.fn(),
  }),
}));
```

### Branch Context
```typescript
jest.mock('@/contexts/ActiveBranchContext', () => ({
  ActiveBranchProvider: ({ children }) => children,
  useActiveBranch: jest.fn().mockReturnValue({
    activeBranchId: 'branch-1',
    activeBranch: { id: 'branch-1', name: 'Main Branch' },
    branches: [{ id: 'branch-1', name: 'Main Branch' }],
    isMultiBranch: false,
    isLoading: false,
    setActiveBranchId: jest.fn(),
  }),
}));
```

### API Client
```typescript
jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
  },
}));
```

---

## Writing Tests

### Basic Component Test

```tsx
import { render, screen } from '@testing-library/react';
import { MyComponent } from './MyComponent';

describe('MyComponent', () => {
  it('renders content', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### With React Query

If your component uses `useQuery` or `useMutation`, wrap with `QueryClientProvider`:

```tsx
import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MyPage } from './MyPage';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return ({ children }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('MyPage', () => {
  it('renders', () => {
    render(<MyPage />, { wrapper: createWrapper() });
    expect(screen.getByTestId('page')).toBeInTheDocument();
  });
});
```

### Mocking React Query Completely

If you need to control query responses:

```typescript
jest.mock('@tanstack/react-query', () => ({
  useQuery: jest.fn().mockReturnValue({
    data: { items: [] },
    isLoading: false,
    error: null,
  }),
  useMutation: jest.fn().mockReturnValue({
    mutate: jest.fn(),
    isPending: false,
  }),
  useQueryClient: jest.fn().mockReturnValue({
    invalidateQueries: jest.fn(),
  }),
}));
```

### Custom Router State

Override the global router mock in specific tests:

```typescript
import { useRouter } from 'next/router';

jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockRouter = useRouter as jest.Mock;

beforeEach(() => {
  mockRouter.mockReturnValue({
    pathname: '/custom/path',
    query: { id: 'test-123' },
    push: jest.fn(),
  });
});
```

---

## Test Utilities

### Location: `apps/web/src/test/test-utils.tsx`

Provides `renderWithProviders()` for advanced scenarios:

```typescript
import { renderWithProviders, createMockUser } from '@/test/test-utils';

it('renders for cashier role', () => {
  const { getByText } = renderWithProviders(<ProtectedComponent />, {
    auth: { user: createMockUser({ jobRole: 'CASHIER' }) },
  });
  expect(getByText('Cashier View')).toBeInTheDocument();
});
```

---

## Common Patterns

### Mocking Layout Components

```typescript
jest.mock('@/components/layout/AppShell', () => ({
  AppShell: ({ children }) => <div data-testid="app-shell">{children}</div>,
}));

jest.mock('@/components/layout/PageHeader', () => ({
  PageHeader: ({ title }) => <h1 data-testid="page-header">{title}</h1>,
}));
```

### Mocking Toast

```typescript
jest.mock('@/components/ui/use-toast', () => ({
  useToast: () => ({ toast: jest.fn() }),
}));
```

---

## Troubleshooting

### "useAuth must be used within AuthProvider"
This error should not occur with the global mocks. If it does:
1. Ensure `jest.setup.ts` is properly configured in `jest.config.ts`
2. Check if test has a local mock that overrides the global mock incorrectly

### "useQueryClient is not a function"
Your `@tanstack/react-query` mock is incomplete. Add:
```typescript
useQueryClient: jest.fn().mockReturnValue({
  invalidateQueries: jest.fn(),
}),
```

### Module Not Found for Hooks
Check the actual path. Common mismatches:
- `@/hooks/use-toast` → should be `@/components/ui/use-toast`
- `@/hooks/useAuth` → should be `@/contexts/AuthContext`

---

*Part of Phase H7 — PRE-012 Resolution*
