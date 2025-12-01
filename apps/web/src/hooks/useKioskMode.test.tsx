// apps/web/src/hooks/useKioskMode.test.tsx
// M29-PWA-S1: Tests for kiosk mode hook
import { renderHook, act } from '@testing-library/react';
import { useKioskMode } from './useKioskMode';

describe('useKioskMode', () => {
  const originalNavigator = global.navigator;
  const originalDocument: any = global.document;
  const originalWindow: any = (global as any).window;

  beforeEach(() => {
    // Mock window to ensure it exists
    (global as any).window = {
      ...originalWindow,
    };

    (global as any).navigator = {
      ...originalNavigator,
      wakeLock: {
        request: jest.fn().mockResolvedValue({
          release: jest.fn().mockResolvedValue(undefined),
          addEventListener: jest.fn(),
        }),
      },
    };
    (global as any).document = {
      ...originalDocument,
      fullscreenEnabled: true,
      webkitFullscreenEnabled: true,
      fullscreenElement: null,
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      documentElement: {
        requestFullscreen: jest.fn().mockResolvedValue(undefined),
      },
      exitFullscreen: jest.fn().mockResolvedValue(undefined),
      visibilityState: 'visible',
    };
  });

  afterEach(() => {
    (global as any).navigator = originalNavigator;
    (global as any).document = originalDocument;
    jest.clearAllMocks();
  });

  test('reports not supported when wakeLock is missing', () => {
    (global as any).navigator = {
      ...originalNavigator,
    };

    const { result } = renderHook(() => useKioskMode());
    expect(result.current.isSupported).toBe(false);
  });

  test('reports not supported when fullscreen is not enabled', () => {
    (global as any).document = {
      ...originalDocument,
      fullscreenEnabled: false,
    };

    const { result } = renderHook(() => useKioskMode());
    expect(result.current.isSupported).toBe(false);
  });

  test('toggleKiosk does not throw when unsupported', async () => {
    (global as any).document = {
      ...originalDocument,
      fullscreenEnabled: false,
    };
    (global as any).navigator = {
      ...originalNavigator,
    };

    const { result } = renderHook(() => useKioskMode());

    expect(result.current.isSupported).toBe(false);

    await act(async () => {
      await result.current.toggleKiosk();
    });

    // No crash: nothing else to assert
    expect(true).toBe(true);
  });

  test('initially reports isActive as false', () => {
    const { result } = renderHook(() => useKioskMode());
    expect(result.current.isActive).toBe(false);
    expect(result.current.isFullscreen).toBe(false);
    expect(result.current.hasWakeLock).toBe(false);
  });
});
