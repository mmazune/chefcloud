/**
 * M33-DEMO-S3: Tests for DemoOrgBadge component
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { DemoOrgBadge } from '../../components/demo/DemoOrgBadge';

describe('DemoOrgBadge', () => {
  it('should render the org name', () => {
    render(<DemoOrgBadge orgName="Tapas Kampala Ltd" />);
    expect(screen.getByText('Tapas Kampala Ltd')).toBeInTheDocument();
  });

  it('should render the DEMO badge', () => {
    render(<DemoOrgBadge orgName="Test Org" />);
    expect(screen.getByText('DEMO')).toBeInTheDocument();
  });

  it('should apply yellow theme styling', () => {
    const { container } = render(<DemoOrgBadge orgName="Test Org" />);
    const badge = container.firstChild as HTMLElement;
    
    // Check for yellow theme classes
    expect(badge.className).toContain('border-yellow-500');
    expect(badge.className).toContain('bg-yellow-500/10');
    expect(badge.className).toContain('text-yellow-300');
  });

  it('should render with uppercase styling', () => {
    const { container } = render(<DemoOrgBadge orgName="Test Org" />);
    const badge = container.firstChild as HTMLElement;
    
    expect(badge.className).toContain('uppercase');
  });

  it('should render inline-flex layout', () => {
    const { container } = render(<DemoOrgBadge orgName="Test Org" />);
    const badge = container.firstChild as HTMLElement;
    
    expect(badge.className).toContain('inline-flex');
  });

  it('should handle long org names', () => {
    const longName = 'Very Long Organization Name That Should Still Display Properly';
    render(<DemoOrgBadge orgName={longName} />);
    expect(screen.getByText(longName)).toBeInTheDocument();
  });

  it('should handle short org names', () => {
    render(<DemoOrgBadge orgName="Org" />);
    expect(screen.getByText('Org')).toBeInTheDocument();
  });
});
