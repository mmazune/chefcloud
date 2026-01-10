/**
 * Phase H5: PlannedFeatureBanner Component Tests
 * 
 * Verifies the PlannedFeatureBanner component renders correctly
 * with different status types and optional props.
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { PlannedFeatureBanner, FeatureStatus } from '@/components/PlannedFeatureBanner';

describe('PlannedFeatureBanner', () => {
  it('renders planned status with correct styling', () => {
    render(
      <PlannedFeatureBanner
        featureName="Developer Portal"
        status="planned"
        description="API documentation and developer tools"
      />
    );

    expect(screen.getByText(/Coming Soon: Developer Portal/i)).toBeInTheDocument();
    expect(screen.getByText(/API documentation and developer tools/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-amber-50');
  });

  it('renders coming-soon status', () => {
    render(
      <PlannedFeatureBanner
        featureName="Advanced Analytics"
        status="coming-soon"
      />
    );

    expect(screen.getByText(/Coming Soon: Advanced Analytics/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-blue-50');
  });

  it('renders deprecated status', () => {
    render(
      <PlannedFeatureBanner
        featureName="Legacy Reports"
        status="deprecated"
      />
    );

    expect(screen.getByText(/Deprecated: Legacy Reports/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-gray-50');
  });

  it('renders beta status', () => {
    render(
      <PlannedFeatureBanner
        featureName="AI Insights"
        status="beta"
      />
    );

    expect(screen.getByText(/Beta: AI Insights/i)).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveClass('bg-purple-50');
  });

  it('displays estimated release when provided', () => {
    render(
      <PlannedFeatureBanner
        featureName="Multi-Currency"
        status="planned"
        estimatedRelease="Q2 2025"
      />
    );

    expect(screen.getByText('Q2 2025')).toBeInTheDocument();
  });

  it('renders learn more link when provided', () => {
    render(
      <PlannedFeatureBanner
        featureName="Webhooks V2"
        status="coming-soon"
        learnMoreUrl="https://docs.example.com/webhooks"
      />
    );

    const link = screen.getByRole('link', { name: /learn more/i });
    expect(link).toHaveAttribute('href', 'https://docs.example.com/webhooks');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('applies custom className', () => {
    render(
      <PlannedFeatureBanner
        featureName="Test Feature"
        status="planned"
        className="custom-class"
      />
    );

    expect(screen.getByRole('status')).toHaveClass('custom-class');
  });

  it('is accessible with proper ARIA attributes', () => {
    render(
      <PlannedFeatureBanner
        featureName="Accessible Feature"
        status="planned"
      />
    );

    const banner = screen.getByRole('status');
    expect(banner).toHaveAttribute('aria-live', 'polite');
  });
});
