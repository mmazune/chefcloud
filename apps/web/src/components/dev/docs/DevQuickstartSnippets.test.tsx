/**
 * Unit tests for DevQuickstartSnippets component (E23-S4)
 */

import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { DevQuickstartSnippets } from './DevQuickstartSnippets';

jest.mock('@/config/devPortalConfig', () => ({
  devPortalConfig: {
    sandboxBaseUrl: 'https://sandbox-api.test.com',
  },
}));

describe('DevQuickstartSnippets', () => {
  it('should render component heading', () => {
    render(<DevQuickstartSnippets />);

    expect(screen.getByText('Sandbox quickstart')).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<DevQuickstartSnippets />);

    expect(
      screen.getByText(/Use Sandbox keys and URLs while you integrate/),
    ).toBeInTheDocument();
  });

  it('should default to curl language', () => {
    render(<DevQuickstartSnippets />);

    const curlButton = screen.getByRole('button', { name: /curl/i });
    expect(curlButton).toHaveClass('bg-slate-100');
  });

  it('should render curl code snippet by default', () => {
    render(<DevQuickstartSnippets />);

    const codeBlock = screen.getByText(/curl -X GET/);
    expect(codeBlock).toBeInTheDocument();
    expect(
      screen.getByText(/https:\/\/sandbox-api.test.com\/v1\/example/),
    ).toBeInTheDocument();
  });

  it('should switch to node snippet when node button clicked', () => {
    render(<DevQuickstartSnippets />);

    const nodeButton = screen.getByRole('button', { name: /node/i });
    fireEvent.click(nodeButton);

    expect(nodeButton).toHaveClass('bg-slate-100');
    expect(screen.getByText(/node-fetch/)).toBeInTheDocument();
    expect(screen.getByText(/import fetch from 'node-fetch'/)).toBeInTheDocument();
  });

  it('should switch to python snippet when python button clicked', () => {
    render(<DevQuickstartSnippets />);

    const pythonButton = screen.getByRole('button', { name: /python/i });
    fireEvent.click(pythonButton);

    expect(pythonButton).toHaveClass('bg-slate-100');
    expect(screen.getByText(/pip install requests/)).toBeInTheDocument();
    expect(screen.getByText(/import requests/)).toBeInTheDocument();
  });

  it('should include API key placeholder in all snippets', () => {
    render(<DevQuickstartSnippets />);

    // Check curl (default)
    expect(screen.getAllByText(/YOUR_API_KEY/).length).toBeGreaterThan(0);

    // Switch to node
    const nodeButton = screen.getByRole('button', { name: /node/i });
    fireEvent.click(nodeButton);
    expect(screen.getAllByText(/YOUR_API_KEY/).length).toBeGreaterThan(0);

    // Switch to python
    const pythonButton = screen.getByRole('button', { name: /python/i });
    fireEvent.click(pythonButton);
    expect(screen.getAllByText(/YOUR_API_KEY/).length).toBeGreaterThan(0);
  });

  it('should render placeholder endpoint notice', () => {
    render(<DevQuickstartSnippets />);

    expect(screen.getAllByText(/\/v1\/example/).length).toBeGreaterThan(0);
    expect(
      screen.getByText(/is a placeholder. Replace it with a real endpoint/),
    ).toBeInTheDocument();
  });

  it('should render all three language buttons', () => {
    render(<DevQuickstartSnippets />);

    expect(screen.getByRole('button', { name: /curl/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /node/i })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /python/i }),
    ).toBeInTheDocument();
  });

  it('should update active button styling when switching languages', () => {
    render(<DevQuickstartSnippets />);

    const curlButton = screen.getByRole('button', { name: /curl/i });
    const nodeButton = screen.getByRole('button', { name: /node/i });

    // Initially curl is active
    expect(curlButton).toHaveClass('bg-slate-100');
    expect(nodeButton).not.toHaveClass('bg-slate-100');

    // Click node
    fireEvent.click(nodeButton);

    // Now node is active
    expect(nodeButton).toHaveClass('bg-slate-100');
    expect(curlButton).not.toHaveClass('bg-slate-100');
  });
});
