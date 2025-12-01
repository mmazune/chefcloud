/**
 * M29-PWA-S3: Tests for useAppUpdateBanner hook
 * 
 * Verifies update detection and reload behavior.
 */

import { renderHook, act } from '@testing-library/react';
import { useAppUpdateBanner } from './useAppUpdateBanner';

jest.mock('@/lib/registerPosServiceWorker', () => ({
  registerPosServiceWorker: jest.fn(),
}));

import { registerPosServiceWorker } from '@/lib/registerPosServiceWorker';

describe('useAppUpdateBanner', () => {
  beforeEach(() => {
    (registerPosServiceWorker as jest.Mock).mockClear();
  });

  test('sets hasUpdate when onUpdateAvailable is called', async () => {
    let capturedCallback: (() => void) | null = null;

    // Mock navigator.serviceWorker.getRegistration
    const mockGetRegistration = jest.fn().mockResolvedValue(null);
    Object.defineProperty((global as any).navigator, 'serviceWorker', {
      writable: true,
      value: {
        getRegistration: mockGetRegistration,
      },
    });

    (registerPosServiceWorker as jest.Mock).mockImplementation(
      ({ onUpdateAvailable }: { onUpdateAvailable?: () => void }) => {
        if (onUpdateAvailable) {
          capturedCallback = onUpdateAvailable;
        }
      }
    );

    const { result } = renderHook(() => useAppUpdateBanner());

    expect(result.current.hasUpdate).toBe(false);

    // Simulate update available
    if (capturedCallback) {
      await act(async () => {
        capturedCallback!();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }

    expect(result.current.hasUpdate).toBe(true);
    
    act(() => {
      result.current.acknowledgeUpdate();
    });
    
    expect(result.current.hasUpdate).toBe(false);
  });

  test('initially has no update', () => {
    // Mock navigator.serviceWorker
    Object.defineProperty((global as any).navigator, 'serviceWorker', {
      writable: true,
      value: {
        getRegistration: jest.fn().mockResolvedValue(null),
      },
    });

    (registerPosServiceWorker as jest.Mock).mockImplementation(() => {
      // No update available
    });

    const { result } = renderHook(() => useAppUpdateBanner());

    expect(result.current.hasUpdate).toBe(false);
  });

  test('acknowledgeUpdate clears the update flag', async () => {
    let capturedCallback: (() => void) | null = null;

    // Mock navigator.serviceWorker.getRegistration
    const mockGetRegistration = jest.fn().mockResolvedValue(null);
    Object.defineProperty((global as any).navigator, 'serviceWorker', {
      writable: true,
      value: {
        getRegistration: mockGetRegistration,
      },
    });

    (registerPosServiceWorker as jest.Mock).mockImplementation(
      ({ onUpdateAvailable }: { onUpdateAvailable?: () => void }) => {
        if (onUpdateAvailable) {
          capturedCallback = onUpdateAvailable;
        }
      }
    );

    const { result } = renderHook(() => useAppUpdateBanner());

    // Simulate update available
    if (capturedCallback) {
      await act(async () => {
        capturedCallback!();
        await new Promise(resolve => setTimeout(resolve, 0));
      });
    }

    expect(result.current.hasUpdate).toBe(true);
    
    act(() => {
      result.current.acknowledgeUpdate();
    });
    
    expect(result.current.hasUpdate).toBe(false);
  });
});
