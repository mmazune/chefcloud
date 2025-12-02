/**
 * M10: Session Policies Configuration
 *
 * Defines idle timeout, max lifetime, and other policies per platform.
 */

// Import Prisma-generated enums to ensure type compatibility
import { SessionPlatform, SessionSource } from '@chefcloud/db';

// Re-export for convenience
export { SessionPlatform, SessionSource };

export interface SessionPolicy {
  idleTimeoutMinutes: number; // Max inactivity before auto-logout
  maxLifetimeHours: number; // Absolute max session duration
  touchThrottleSeconds: number; // Min interval between lastActivityAt updates
}

/**
 * Default session policies per platform
 */
export const SESSION_POLICIES: Record<SessionPlatform, SessionPolicy> = {
  // POS/KDS: Short idle timeout for shared terminals, 12h max
  [SessionPlatform.POS_DESKTOP]: {
    idleTimeoutMinutes: 10,
    maxLifetimeHours: 12,
    touchThrottleSeconds: 60, // Update lastActivityAt max once per minute
  },
  [SessionPlatform.KDS_SCREEN]: {
    idleTimeoutMinutes: 5,
    maxLifetimeHours: 12,
    touchThrottleSeconds: 60,
  },

  // Web backoffice: Moderate idle timeout, 8h max
  [SessionPlatform.WEB_BACKOFFICE]: {
    idleTimeoutMinutes: 30,
    maxLifetimeHours: 8,
    touchThrottleSeconds: 120, // 2 minutes
  },

  // Mobile: Longer idle (users may background app), 24h max
  [SessionPlatform.MOBILE_APP]: {
    idleTimeoutMinutes: 60,
    maxLifetimeHours: 24,
    touchThrottleSeconds: 120,
  },

  // Dev portal: Moderate idle, 8h max
  [SessionPlatform.DEV_PORTAL]: {
    idleTimeoutMinutes: 30,
    maxLifetimeHours: 8,
    touchThrottleSeconds: 120,
  },

  // Other/Unknown: Conservative defaults
  [SessionPlatform.OTHER]: {
    idleTimeoutMinutes: 15,
    maxLifetimeHours: 8,
    touchThrottleSeconds: 60,
  },
};

/**
 * Get session policy for a platform
 */
export function getSessionPolicy(platform: SessionPlatform): SessionPolicy {
  return SESSION_POLICIES[platform] || SESSION_POLICIES[SessionPlatform.OTHER];
}

/**
 * Calculate session expiry based on policy
 */
export function calculateSessionExpiry(platform: SessionPlatform): Date {
  const policy = getSessionPolicy(platform);
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + policy.maxLifetimeHours);
  return expiry;
}

/**
 * Check if session should be considered idle
 */
export function isSessionIdle(lastActivityAt: Date, platform: SessionPlatform): boolean {
  const policy = getSessionPolicy(platform);
  const idleThresholdMs = policy.idleTimeoutMinutes * 60 * 1000;
  const elapsedMs = Date.now() - lastActivityAt.getTime();
  return elapsedMs > idleThresholdMs;
}

/**
 * Check if session has exceeded max lifetime
 */
export function isSessionExpired(createdAt: Date, platform: SessionPlatform): boolean {
  const policy = getSessionPolicy(platform);
  const maxLifetimeMs = policy.maxLifetimeHours * 60 * 60 * 1000;
  const elapsedMs = Date.now() - createdAt.getTime();
  return elapsedMs > maxLifetimeMs;
}

/**
 * Check if lastActivityAt should be updated (throttling)
 */
export function shouldTouchSession(lastActivityAt: Date, platform: SessionPlatform): boolean {
  const policy = getSessionPolicy(platform);
  const throttleMs = policy.touchThrottleSeconds * 1000;
  const elapsedMs = Date.now() - lastActivityAt.getTime();
  return elapsedMs >= throttleMs;
}
