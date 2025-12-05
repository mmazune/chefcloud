/**
 * M32-SEC-S2: Centralized auth HTTP error handler
 * Handles 401/419 responses by redirecting to login with session_expired reason
 */

const EXPIRED_STATUSES = new Set([401, 419]);

export function handleAuthHttpError(status: number): void {
  if (!EXPIRED_STATUSES.has(status)) {
    return;
  }

  if (typeof window === 'undefined') {
    // SSR safety: do nothing on server-side render
    return;
  }

  try {
    const params = new URLSearchParams({
      reason: 'session_expired',
    });
    const target = `/login?${params.toString()}`;
    // Use assign so it behaves like a navigation, not SPA history hack
    window.location.assign(target);
  } catch (err) {
    // Last-resort fallback
    window.location.href = '/login';
  }
}
