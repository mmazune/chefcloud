import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  SessionPlatform,
  SessionSource,
  calculateSessionExpiry,
  isSessionIdle,
  isSessionExpired,
  shouldTouchSession,
} from './session-policies';

export interface CreateSessionParams {
  userId: string;
  orgId: string;
  branchId?: string;
  employeeId?: string;
  platform: SessionPlatform;
  source: SessionSource;
  deviceId?: string;
  badgeId?: string;
  ipAddress?: string;
  userAgent?: string;
  jti: string; // JWT ID for token tracking
}

export interface SessionValidationResult {
  valid: boolean;
  reason?: string;
  shouldTouch?: boolean;
}

/**
 * M10: SessionsService
 *
 * Manages canonical session lifecycle with:
 * - Platform-aware session creation
 * - Idle timeout enforcement
 * - Activity tracking with throttling
 * - Manual and automatic revocation
 * - Session audit trail
 *
 * @example
 * ```typescript
 * // Create session on login
 * const session = await sessionsService.createSession({
 *   userId: 'user_123',
 *   orgId: 'org_456',
 *   platform: SessionPlatform.POS_DESKTOP,
 *   source: SessionSource.MSR_CARD,
 *   jti: 'abc123...',
 * });
 *
 * // Validate and touch session on each request
 * const result = await sessionsService.validateSession(session.id);
 * if (!result.valid) {
 *   throw new UnauthorizedException(result.reason);
 * }
 *
 * // Manual logout
 * await sessionsService.revokeSession(session.id, userId, 'User logged out');
 * ```
 */
@Injectable()
export class SessionsService {
  private readonly logger = new Logger(SessionsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Create a new session on login
   */
  async createSession(params: CreateSessionParams) {
    const expiresAt = calculateSessionExpiry(params.platform);

    const session = await this.prisma.client.session.create({
      data: {
        userId: params.userId,
        orgId: params.orgId,
        branchId: params.branchId,
        employeeId: params.employeeId,
        platform: params.platform,
        source: params.source,
        deviceId: params.deviceId,
        badgeId: params.badgeId,
        ipAddress: params.ipAddress,
        userAgent: params.userAgent,
        token: params.jti, // Store JTI (not full JWT) for lookups
        expiresAt,
        lastActivityAt: new Date(),
      },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            roleLevel: true,
          },
        },
      },
    });

    this.logger.log(
      `Session created: ${session.id} for user ${params.userId} on ${params.platform} via ${params.source}`,
    );

    return session;
  }

  /**
   * Validate session and check for idle/expiry
   * Returns validation result with reason if invalid
   */
  async validateSession(sessionId: string): Promise<SessionValidationResult> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return { valid: false, reason: 'Session not found' };
    }

    // Check if manually revoked
    if (session.revokedAt) {
      return {
        valid: false,
        reason: session.revokedReason || 'Session has been revoked',
      };
    }

    // Check if naturally expired
    if (session.expiresAt < new Date()) {
      return { valid: false, reason: 'Session has expired' };
    }

    // Check if idle timeout exceeded
    if (isSessionIdle(session.lastActivityAt, session.platform)) {
      // Auto-revoke idle session
      await this.revokeSession(sessionId, undefined, 'Idle timeout exceeded');
      return { valid: false, reason: 'Session idle timeout exceeded' };
    }

    // Check if absolute lifetime exceeded (rare - should be caught by expiresAt)
    if (isSessionExpired(session.createdAt, session.platform)) {
      await this.revokeSession(sessionId, undefined, 'Maximum session lifetime exceeded');
      return { valid: false, reason: 'Session maximum lifetime exceeded' };
    }

    // Determine if lastActivityAt should be updated (throttled)
    const shouldTouch = shouldTouchSession(session.lastActivityAt, session.platform);

    return { valid: true, shouldTouch };
  }

  /**
   * Update lastActivityAt to extend session idle timeout
   * Only updates if throttle period has elapsed
   */
  async touchSession(sessionId: string): Promise<void> {
    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: { lastActivityAt: new Date() },
    });

    this.logger.debug(`Session touched: ${sessionId}`);
  }

  /**
   * Manually revoke a session (logout)
   */
  async revokeSession(sessionId: string, revokedById?: string, reason?: string): Promise<void> {
    const session = await this.prisma.client.session.findUnique({
      where: { id: sessionId },
      select: { id: true, userId: true, platform: true, revokedAt: true },
    });

    if (!session) {
      this.logger.warn(`Attempted to revoke non-existent session: ${sessionId}`);
      return;
    }

    if (session.revokedAt) {
      this.logger.debug(`Session already revoked: ${sessionId}`);
      return;
    }

    await this.prisma.client.session.update({
      where: { id: sessionId },
      data: {
        revokedAt: new Date(),
        revokedById,
        revokedReason: reason || 'Manual logout',
      },
    });

    this.logger.log(
      `Session revoked: ${sessionId} for user ${session.userId} on ${session.platform} - ${reason || 'Manual logout'}`,
    );
  }

  /**
   * Revoke all sessions for a user (logout all)
   */
  async revokeAllUserSessions(
    userId: string,
    revokedById?: string,
    reason?: string,
  ): Promise<number> {
    const result = await this.prisma.client.session.updateMany({
      where: {
        userId,
        revokedAt: null, // Only revoke active sessions
      },
      data: {
        revokedAt: new Date(),
        revokedById,
        revokedReason: reason || 'Logout all sessions',
      },
    });

    this.logger.log(
      `Revoked ${result.count} sessions for user ${userId} - ${reason || 'Logout all'}`,
    );

    return result.count;
  }

  /**
   * Revoke all sessions for a badge (when badge is revoked/lost)
   */
  async revokeAllBadgeSessions(badgeId: string, reason: string): Promise<number> {
    const result = await this.prisma.client.session.updateMany({
      where: {
        badgeId,
        revokedAt: null,
      },
      data: {
        revokedAt: new Date(),
        revokedReason: `Badge ${reason}`,
      },
    });

    this.logger.log(`Revoked ${result.count} sessions for badge ${badgeId} - ${reason}`);

    return result.count;
  }

  /**
   * Get active sessions for a user
   */
  async getUserSessions(userId: string) {
    return this.prisma.client.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gte: new Date() },
      },
      orderBy: { lastActivityAt: 'desc' },
      select: {
        id: true,
        platform: true,
        source: true,
        createdAt: true,
        lastActivityAt: true,
        expiresAt: true,
        ipAddress: true,
        userAgent: true,
        device: {
          select: {
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get session by JTI (from JWT claim)
   * Used by JwtStrategy to validate tokens
   */
  async getSessionByJti(jti: string) {
    return this.prisma.client.session.findUnique({
      where: { token: jti },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
            roleLevel: true,
            orgId: true,
            branchId: true,
            sessionVersion: true,
            isActive: true,
          },
        },
      },
    });
  }

  /**
   * Cleanup expired sessions (cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.client.session.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: new Date() } },
          { revokedAt: { lt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } }, // Keep revoked for 7 days
        ],
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired/old sessions`);

    return result.count;
  }
}
