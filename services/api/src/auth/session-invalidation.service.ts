import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RedisService } from '../common/redis.service';
import * as crypto from 'crypto';

/**
 * SessionInvalidationService
 * 
 * Handles session invalidation when badges are revoked, lost, or returned.
 * Implements versioned tokens and Redis-based deny lists for immediate invalidation.
 * 
 * Features (E25):
 * - Increment user sessionVersion to invalidate all old JWTs
 * - Add JTI (JWT ID) to Redis deny list for immediate rejection (2s propagation)
 * - Invalidate sessions by userId or badgeId
 * - Event-driven architecture for distributed systems
 * 
 * @example
 * ```typescript
 * // When badge is revoked
 * await sessionInvalidation.invalidateByBadge('badge-123', 'REVOKED');
 * 
 * // When user is deactivated
 * await sessionInvalidation.invalidateByUser('user-456');
 * ```
 */
@Injectable()
export class SessionInvalidationService {
  private readonly logger = new Logger(SessionInvalidationService.name);
  private readonly DENY_LIST_TTL = 86400; // 24 hours (longer than max JWT lifetime)

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Invalidate all sessions for a specific badge
   * Called when badge state changes to REVOKED, LOST, or SEPARATED
   * 
   * @param badgeId - Badge asset ID
   * @param reason - Reason for invalidation (REVOKED, LOST, etc.)
   * @returns Number of sessions invalidated
   */
  async invalidateByBadge(badgeId: string, reason: string): Promise<number> {
    this.logger.log(`Invalidating sessions for badge ${badgeId} (reason: ${reason})`);

    try {
      // Find all sessions associated with this badge
      const sessions = await this.prisma.client.session.findMany({
        where: { badgeId },
        include: { user: true },
      });

      if (sessions.length === 0) {
        this.logger.debug(`No active sessions found for badge ${badgeId}`);
        return 0;
      }

      // Get unique user IDs
      const userIds = [...new Set(sessions.map(s => s.userId))];

      // Increment sessionVersion for all affected users
      await this.prisma.client.user.updateMany({
        where: { id: { in: userIds } },
        data: { sessionVersion: { increment: 1 } },
      });

      // Add session tokens to deny list (for immediate invalidation)
      const denyListOps = sessions.map(session =>
        this.addToDenyList(session.token, `badge_${reason.toLowerCase()}`)
      );
      await Promise.all(denyListOps);

      // Delete session records from database
      const deleteResult = await this.prisma.client.session.deleteMany({
        where: { badgeId },
      });

      this.logger.log(
        `Invalidated ${deleteResult.count} sessions for badge ${badgeId} affecting ${userIds.length} users`
      );

      // Emit event for distributed systems (optional, for future pub/sub)
      await this.emitInvalidationEvent({
        type: 'badge',
        badgeId,
        userIds,
        reason,
        sessionCount: deleteResult.count,
        timestamp: new Date().toISOString(),
      });

      return deleteResult.count;
    } catch (error) {
      this.logger.error(`Failed to invalidate sessions for badge ${badgeId}:`, error);
      throw error;
    }
  }

  /**
   * Invalidate all sessions for a specific user
   * Called when user is deactivated or manually logged out
   * 
   * @param userId - User ID
   * @param reason - Reason for invalidation
   * @returns Number of sessions invalidated
   */
  async invalidateByUser(userId: string, reason = 'user_action'): Promise<number> {
    this.logger.log(`Invalidating all sessions for user ${userId} (reason: ${reason})`);

    try {
      // Find all sessions for this user
      const sessions = await this.prisma.client.session.findMany({
        where: { userId },
      });

      if (sessions.length === 0) {
        this.logger.debug(`No active sessions found for user ${userId}`);
        return 0;
      }

      // Increment sessionVersion
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      });

      // Add tokens to deny list
      const denyListOps = sessions.map(session =>
        this.addToDenyList(session.token, reason)
      );
      await Promise.all(denyListOps);

      // Delete session records
      const deleteResult = await this.prisma.client.session.deleteMany({
        where: { userId },
      });

      this.logger.log(`Invalidated ${deleteResult.count} sessions for user ${userId}`);

      // Emit event
      await this.emitInvalidationEvent({
        type: 'user',
        userId,
        reason,
        sessionCount: deleteResult.count,
        timestamp: new Date().toISOString(),
      });

      return deleteResult.count;
    } catch (error) {
      this.logger.error(`Failed to invalidate sessions for user ${userId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a JWT token is in the deny list
   * Used by JwtStrategy for immediate rejection
   * 
   * @param jti - JWT ID (from token claims)
   * @returns true if token is denied
   */
  async isDenied(jti: string): Promise<boolean> {
    try {
      const key = `deny:${jti}`;
      const result = await this.redis.get(key);
      return result !== null;
    } catch (error) {
      // If Redis is down, don't block authentication
      // Version check will still catch invalidated tokens
      this.logger.warn(`Redis check failed for jti ${jti}, allowing (fail-open):`, error);
      return false;
    }
  }

  /**
   * Add a JWT token to the deny list
   * Private method used during session invalidation
   * 
   * @param token - Full JWT token string
   * @param reason - Reason for denial
   */
  private async addToDenyList(token: string, reason: string): Promise<void> {
    try {
      // Extract JTI from token (JWT ID claim)
      // In production, you'd decode the token properly
      // For now, we'll use the token hash as the key
      const jti = this.hashToken(token);
      const key = `deny:${jti}`;
      
      await this.redis.set(key, JSON.stringify({ reason, timestamp: Date.now() }), this.DENY_LIST_TTL);
      
      this.logger.debug(`Added token to deny list: ${jti.substring(0, 8)}... (reason: ${reason})`);
    } catch (error) {
      // Don't fail the invalidation if Redis is down
      // Version check will still work
      this.logger.warn(`Failed to add token to deny list (non-critical):`, error);
    }
  }

  /**
   * Hash a token to create a consistent JTI
   * In production, this should extract the actual 'jti' claim from the JWT
   */
  private hashToken(token: string): string {
    // Simple hash for demo - in production, decode JWT and use actual 'jti' claim
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Emit invalidation event for distributed systems
   * Can be picked up by Redis pub/sub subscribers in multi-node deployments
   */
  private async emitInvalidationEvent(event: Record<string, unknown>): Promise<void> {
    try {
      const channel = 'session:invalidation';
      await this.redis.publish(channel, JSON.stringify(event));
      this.logger.debug(`Published invalidation event to ${channel}`);
    } catch (error) {
      // Non-critical - local invalidation already done
      this.logger.debug(`Failed to publish invalidation event (non-critical):`, error);
    }
  }

  /**
   * Get current session version for a user
   * Used during token generation to embed correct version
   * 
   * @param userId - User ID
   * @returns Current session version
   */
  async getSessionVersion(userId: string): Promise<number> {
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      select: { sessionVersion: true },
    });
    
    return user?.sessionVersion ?? 0;
  }

  /**
   * Clean up expired sessions from database
   * Should be called periodically (e.g., daily cron job)
   */
  async cleanupExpiredSessions(): Promise<number> {
    const result = await this.prisma.client.session.deleteMany({
      where: {
        expiresAt: {
          lt: new Date(),
        },
      },
    });

    this.logger.log(`Cleaned up ${result.count} expired sessions`);
    return result.count;
  }
}
