/**
 * M31-A11Y-S3: Accessibility tests for Sidebar navigation semantics
 */
import { render, screen } from '@testing-library/react';
import { useRouter } from 'next/router';
import { Sidebar } from './Sidebar';

// Mock Next.js router
jest.mock('next/router', () => ({
  useRouter: jest.fn(),
}));

const mockUseRouter = useRouter as jest.MockedFunction<typeof useRouter>;

describe('Sidebar Accessibility', () => {
  beforeEach(() => {
    mockUseRouter.mockReturnValue({
      pathname: '/analytics',
      route: '/analytics',
      query: {},
      asPath: '/analytics',
      basePath: '',
      isLocaleDomain: false,
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
      isReady: true,
      isPreview: false,
    } as any);
  });

  it('should have nav landmark with aria-label', () => {
    render(<Sidebar />);
    const nav = screen.getByRole('navigation', { name: /primary/i });
    expect(nav).toBeInTheDocument();
  });

  it('should set aria-current="page" on active link', () => {
    render(<Sidebar />);
    const analyticsLink = screen.getByRole('link', { name: /analytics/i });
    expect(analyticsLink).toHaveAttribute('aria-current', 'page');
  });

  it('should not set aria-current on inactive links', () => {
    render(<Sidebar />);
    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).not.toHaveAttribute('aria-current');
  });

  it('should update aria-current when route changes', () => {
    const { rerender } = render(<Sidebar />);
    
    // Initially on /analytics
    let analyticsLink = screen.getByRole('link', { name: /analytics/i });
    expect(analyticsLink).toHaveAttribute('aria-current', 'page');

    // Navigate to /dashboard
    mockUseRouter.mockReturnValue({
      pathname: '/dashboard',
      route: '/dashboard',
      query: {},
      asPath: '/dashboard',
      basePath: '',
      isLocaleDomain: false,
      push: jest.fn(),
      replace: jest.fn(),
      reload: jest.fn(),
      back: jest.fn(),
      prefetch: jest.fn(),
      beforePopState: jest.fn(),
      events: {
        on: jest.fn(),
        off: jest.fn(),
        emit: jest.fn(),
      },
      isFallback: false,
      isReady: true,
      isPreview: false,
    } as any);

    rerender(<Sidebar />);

    const dashboardLink = screen.getByRole('link', { name: /dashboard/i });
    expect(dashboardLink).toHaveAttribute('aria-current', 'page');
    
    analyticsLink = screen.getByRole('link', { name: /analytics/i });
    expect(analyticsLink).not.toHaveAttribute('aria-current');
  });
});
