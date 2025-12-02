/**
 * Unit tests for DevSecurityBestPracticesCard component (E23-S4)
 */

import React from 'react';
import { render, screen } from '@testing-library/react';
import { DevSecurityBestPracticesCard } from './DevSecurityBestPracticesCard';

describe('DevSecurityBestPracticesCard', () => {
  it('should render component heading', () => {
    render(<DevSecurityBestPracticesCard />);

    expect(screen.getByText('Security best practices')).toBeInTheDocument();
  });

  it('should render "Do not hard-code keys" guidance', () => {
    render(<DevSecurityBestPracticesCard />);

    expect(screen.getByText(/Do not hard-code keys:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Store API keys and webhook secrets in environment variables/),
    ).toBeInTheDocument();
    expect(screen.getByText(/never in source control/)).toBeInTheDocument();
  });

  it('should render "Use least privilege" guidance', () => {
    render(<DevSecurityBestPracticesCard />);

    expect(screen.getByText(/Use least privilege:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Prefer Sandbox keys in development and staging/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Use Production keys only in production services/),
    ).toBeInTheDocument();
  });

  it('should render "Rotate regularly" guidance', () => {
    render(<DevSecurityBestPracticesCard />);

    expect(screen.getByText(/Rotate regularly:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Rotate API keys and webhook secrets periodically/),
    ).toBeInTheDocument();
    expect(screen.getByText(/after any suspected leak/)).toBeInTheDocument();
  });

  it('should render "Validate TLS" guidance', () => {
    render(<DevSecurityBestPracticesCard />);

    expect(screen.getByText(/Validate TLS:/)).toBeInTheDocument();
    expect(screen.getByText(/https:\/\//)).toBeInTheDocument();
    expect(
      screen.getByText(/ensure your webhook endpoints are HTTPS/),
    ).toBeInTheDocument();
  });

  it('should render "Log safely" guidance', () => {
    render(<DevSecurityBestPracticesCard />);

    expect(screen.getByText(/Log safely:/)).toBeInTheDocument();
    expect(
      screen.getByText(/Log request IDs and error messages/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/never log full API keys or webhook secrets/),
    ).toBeInTheDocument();
  });

  it('should render all five security practices', () => {
    const { container } = render(<DevSecurityBestPracticesCard />);

    const list = container.querySelector('ul');
    expect(list).toBeInTheDocument();
    expect(list?.children).toHaveLength(5);
  });

  it('should use unordered list for practices', () => {
    const { container } = render(<DevSecurityBestPracticesCard />);

    const unorderedList = container.querySelector('ul');
    expect(unorderedList).toBeInTheDocument();
  });
});
