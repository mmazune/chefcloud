// apps/web/jest.setup.ts
import '@testing-library/jest-dom';

// ============================================================================
// Browser API Mocks
// ============================================================================

// Simple localStorage mock if not provided by jsdom
if (typeof window !== 'undefined' && !window.localStorage) {
  const store: Record<string, string> = {};
  // @ts-ignore
  window.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(k => delete store[k]);
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
}

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
    text: async () => '',
  } as any)
);

// M26-EXT1: Mock crypto.randomUUID for split bill tests
if (typeof crypto === 'undefined') {
  // @ts-ignore
  global.crypto = {};
}
if (typeof crypto.randomUUID === 'undefined') {
  // Simple UUID v4 implementation for tests
  // @ts-ignore - Type mismatch between test mock and actual crypto API
  crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: jest.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: jest.fn(),
    removeListener: jest.fn(),
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
    dispatchEvent: jest.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = class ResizeObserver {
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
};

// Mock IntersectionObserver
global.IntersectionObserver = class IntersectionObserver {
  root = null;
  rootMargin = '';
  thresholds = [];
  observe = jest.fn();
  unobserve = jest.fn();
  disconnect = jest.fn();
  takeRecords = jest.fn().mockReturnValue([]);
} as unknown as typeof IntersectionObserver;

// ============================================================================
// Next.js Router Mock
// ============================================================================

jest.mock('next/router', () => ({
  useRouter: jest.fn().mockReturnValue({
    pathname: '/',
    route: '/',
    query: {},
    asPath: '/',
    basePath: '',
    isLocaleDomain: false,
    push: jest.fn().mockResolvedValue(true),
    replace: jest.fn().mockResolvedValue(true),
    reload: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn().mockResolvedValue(undefined),
    beforePopState: jest.fn(),
    events: {
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    },
    isFallback: false,
    isReady: true,
    isPreview: false,
  }),
}));

// Mock next/navigation for App Router components
jest.mock('next/navigation', () => ({
  useRouter: jest.fn().mockReturnValue({
    push: jest.fn(),
    replace: jest.fn(),
    back: jest.fn(),
    forward: jest.fn(),
    prefetch: jest.fn(),
    refresh: jest.fn(),
  }),
  usePathname: jest.fn().mockReturnValue('/'),
  useSearchParams: jest.fn().mockReturnValue(new URLSearchParams()),
  useParams: jest.fn().mockReturnValue({}),
}));

// ============================================================================
// Auth & Branch Context Mocks
// ============================================================================

// Default mock user for tests
const mockUser = {
  id: 'test-user-1',
  email: 'owner@demo.com',
  name: 'Test Owner',
  jobRole: 'OWNER',
  org: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
  branch: { id: 'branch-1', name: 'Main Branch' },
  permissions: ['*'],
};

// Mock AuthContext
jest.mock('@/contexts/AuthContext', () => ({
  AuthProvider: ({ children }: { children: React.ReactNode }) => children,
  useAuth: jest.fn().mockReturnValue({
    user: mockUser,
    loading: false,
    error: null,
    login: jest.fn(),
    pinLogin: jest.fn(),
    logout: jest.fn(),
    refetchUser: jest.fn(),
  }),
}));

// Mock ActiveBranchContext
jest.mock('@/contexts/ActiveBranchContext', () => ({
  ActiveBranchProvider: ({ children }: { children: React.ReactNode }) => children,
  useActiveBranch: jest.fn().mockReturnValue({
    activeBranchId: 'branch-1',
    activeBranch: { id: 'branch-1', name: 'Main Branch' },
    branches: [{ id: 'branch-1', name: 'Main Branch' }],
    isMultiBranch: false,
    isLoading: false,
    setActiveBranchId: jest.fn(),
  }),
}));

// ============================================================================
// API Client Mock
// ============================================================================

jest.mock('@/lib/api', () => ({
  apiClient: {
    get: jest.fn().mockResolvedValue({ data: {} }),
    post: jest.fn().mockResolvedValue({ data: {} }),
    put: jest.fn().mockResolvedValue({ data: {} }),
    patch: jest.fn().mockResolvedValue({ data: {} }),
    delete: jest.fn().mockResolvedValue({ data: {} }),
  },
}));

// ============================================================================
// Suppress Expected React Errors in Tests
// ============================================================================

const originalError = console.error;
beforeAll(() => {
  console.error = (...args: any[]) => {
    // Suppress act() warnings in async tests - these are often false positives
    if (
      typeof args[0] === 'string' &&
      args[0].includes('Warning: An update to') &&
      args[0].includes('was not wrapped in act')
    ) {
      return;
    }
    originalError.call(console, ...args);
  };
});

afterAll(() => {
  console.error = originalError;
});
