import React from 'react';
import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { AppErrorBoundary, readLastErrorRecord, clearLastErrorRecord } from './AppErrorBoundary';

function ProblemChild() {
  throw new Error('Boom');
}

describe('AppErrorBoundary', () => {
  beforeEach(() => {
    clearLastErrorRecord();
  });

  test('renders fallback UI on error and stores last error', () => {
    // Suppress console.error for this test
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <AppErrorBoundary context="POS">
        <ProblemChild />
      </AppErrorBoundary>,
    );

    expect(screen.getByText(/Something went wrong/i)).toBeInTheDocument();

    const record = readLastErrorRecord();
    expect(record).not.toBeNull();
    expect(record?.context).toBe('POS');
    expect(record?.message).toBe('Boom');

    consoleErrorSpy.mockRestore();
  });
});
