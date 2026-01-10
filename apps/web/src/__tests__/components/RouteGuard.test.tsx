/**
 * RouteGuard and NoAccessPage Component Tests
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { RouteGuard } from '@/components/RouteGuard';
import { NoAccessPage } from '@/components/NoAccessPage';

// Mock the AuthContext
const mockUser = {
  id: 'user-1',
  email: 'owner@test.com',
  name: 'Test Owner',
  jobRole: 'OWNER',
  roleLevel: 'L5' as const,
  branchId: 'branch-1',
  tenantId: 'tenant-1',
};

jest.mock('@/contexts/AuthContext', () => ({
  useAuth: jest.fn(() => ({
    user: mockUser,
    loading: false,
    error: null,
  })),
}));

// Mock next/router
const mockRouter = {
  pathname: '/pos',
  query: {},
  push: jest.fn(),
  replace: jest.fn(),
};

jest.mock('next/router', () => ({
  useRouter: () => mockRouter,
}));

// Get the mocked useAuth
import { useAuth } from '@/contexts/AuthContext';
const mockedUseAuth = useAuth as jest.Mock;

describe('RouteGuard', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRouter.pathname = '/pos';
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      error: null,
    });
  });

  it('renders children when user has access', () => {
    render(
      <RouteGuard>
        <div data-testid="protected-content">Protected Content</div>
      </RouteGuard>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });

  it('renders loading state when auth is loading', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: true,
      error: null,
    });

    render(
      <RouteGuard>
        <div data-testid="protected-content">Protected Content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders NoAccessPage when user is not authenticated', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
    });

    render(
      <RouteGuard>
        <div data-testid="protected-content">Protected Content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('renders NoAccessPage when user lacks route permission', () => {
    mockRouter.pathname = '/finance';
    mockedUseAuth.mockReturnValue({
      user: { ...mockUser, jobRole: 'WAITER' },
      loading: false,
      error: null,
    });

    render(
      <RouteGuard>
        <div data-testid="protected-content">Protected Content</div>
      </RouteGuard>
    );

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.queryByTestId('protected-content')).not.toBeInTheDocument();
  });

  it('bypasses guard when bypass prop is true', () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      loading: false,
      error: null,
    });

    render(
      <RouteGuard bypass>
        <div data-testid="public-content">Public Content</div>
      </RouteGuard>
    );

    expect(screen.getByTestId('public-content')).toBeInTheDocument();
  });
});

describe('NoAccessPage', () => {
  beforeEach(() => {
    mockedUseAuth.mockReturnValue({
      user: mockUser,
      loading: false,
      error: null,
    });
  });

  it('renders forbidden message', () => {
    render(<NoAccessPage reason="forbidden" route="/finance" role="WAITER" />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/You don't have permission/)).toBeInTheDocument();
  });

  it('shows route and role details for forbidden', () => {
    render(<NoAccessPage reason="forbidden" route="/finance" role="WAITER" />);

    expect(screen.getByText('/finance')).toBeInTheDocument();
    expect(screen.getByText(/WAITER/)).toBeInTheDocument();
  });

  it('renders not-authenticated message', () => {
    render(<NoAccessPage reason="not-authenticated" />);

    expect(screen.getByText('Access Denied')).toBeInTheDocument();
    expect(screen.getByText(/need to be logged in/)).toBeInTheDocument();
  });

  it('shows action buttons', () => {
    render(<NoAccessPage reason="forbidden" route="/finance" role="WAITER" />);

    expect(screen.getByText('Go Back')).toBeInTheDocument();
    expect(screen.getByText('Go to Dashboard')).toBeInTheDocument();
  });
});
