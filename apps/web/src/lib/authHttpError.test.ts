/**
 * Unit tests for authHttpError helper (M32-SEC-S2)
 */

import { handleAuthHttpError } from './authHttpError';

describe('handleAuthHttpError', () => {
  const mockAssign = jest.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock window.location.assign
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      assign: mockAssign,
    } as any;
  });

  afterEach(() => {
    window.location = originalLocation;
  });

  it('redirects to login with session_expired reason on 401', () => {
    handleAuthHttpError(401);

    expect(mockAssign).toHaveBeenCalledTimes(1);
    expect(mockAssign).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('redirects to login with session_expired reason on 419', () => {
    handleAuthHttpError(419);

    expect(mockAssign).toHaveBeenCalledTimes(1);
    expect(mockAssign).toHaveBeenCalledWith('/login?reason=session_expired');
  });

  it('does not redirect on 500 (server error)', () => {
    handleAuthHttpError(500);

    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('does not redirect on 404 (not found)', () => {
    handleAuthHttpError(404);

    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('does not redirect on 200 (success)', () => {
    handleAuthHttpError(200);

    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('does not redirect on 400 (bad request)', () => {
    handleAuthHttpError(400);

    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('does not redirect on 403 (forbidden)', () => {
    handleAuthHttpError(403);

    expect(mockAssign).not.toHaveBeenCalled();
  });

  it('is SSR-safe and does not crash when window is undefined', () => {
    const originalWindow = global.window;
    delete (global as any).window;

    expect(() => {
      handleAuthHttpError(401);
    }).not.toThrow();

    // Restore window
    global.window = originalWindow;
  });

  it('uses window.location.href fallback if assign throws', () => {
    const mockAssignThrowing = jest.fn(() => {
      throw new Error('URLSearchParams not supported');
    });
    delete (window as any).location;
    window.location = {
      ...originalLocation,
      assign: mockAssignThrowing,
      href: '',
    } as any;

    handleAuthHttpError(401);

    expect(mockAssignThrowing).toHaveBeenCalledTimes(1);
    expect(window.location.href).toBe('/login');
  });

  it('includes correct query parameter format', () => {
    handleAuthHttpError(419);

    const calledUrl = mockAssign.mock.calls[0][0];
    expect(calledUrl).toContain('reason=');
    expect(calledUrl).toContain('session_expired');
    expect(calledUrl).toMatch(/^\/login\?/);
  });
});
