import { renderHook, act } from '@testing-library/react';
import { useLastErrorRecord } from './useLastErrorRecord';
import { clearLastErrorRecord, readLastErrorRecord } from '@/components/common/AppErrorBoundary';

// Simulate a pre-existing error in localStorage
function seedError() {
  const record = {
    context: 'POS' as const,
    message: 'Seeded error',
    stack: null,
    componentStack: null,
    timestampIso: '2025-01-01T00:00:00.000Z',
  };
  if (typeof window !== 'undefined') {
    window.localStorage.setItem('chefcloud_last_error_v1', JSON.stringify(record));
  }
}

describe('useLastErrorRecord', () => {
  beforeEach(() => {
    clearLastErrorRecord();
  });

  test('reads existing last error on mount and can clear it', () => {
    seedError();

    const { result } = renderHook(() => useLastErrorRecord());

    expect(result.current.lastError).not.toBeNull();
    expect(result.current.lastError?.message).toBe('Seeded error');

    act(() => {
      result.current.clear();
    });

    expect(result.current.lastError).toBeNull();
    expect(readLastErrorRecord()).toBeNull();
  });
});
