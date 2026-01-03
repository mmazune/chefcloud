/**
 * M9.4: Access Token Service
 * 
 * Manages secure tokens for public reservation access (cancel/reschedule)
 */
import { Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { randomBytes } from 'crypto';

export type TokenScope = 'CANCEL' | 'RESCHEDULE' | 'VIEW' | 'ALL';

@Injectable()
export class AccessTokenService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Generate a secure access token for a reservation
   */
  async generateToken(
    reservationId: string,
    scope: TokenScope = 'ALL',
    expiryHours: number = 72,
  ): Promise<{ token: string; expiresAt: Date }> {
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    await this.prisma.client.reservationAccessToken.create({
      data: {
        reservationId,
        token,
        scope,
        expiresAt,
      },
    });

    return { token, expiresAt };
  }

  /**
   * Validate a token and return the reservation ID if valid
   */
  async validateToken(
    token: string,
    requiredScope: TokenScope,
  ): Promise<{ reservationId: string }> {
    const accessToken = await this.prisma.client.reservationAccessToken.findUnique({
      where: { token },
      include: { reservation: { select: { id: true, orgId: true, branchId: true } } },
    });

    if (!accessToken) {
      throw new UnauthorizedException('Invalid access token');
    }

    if (accessToken.expiresAt < new Date()) {
      throw new UnauthorizedException('Access token has expired');
    }

    // Check scope - ALL scope allows everything
    if (accessToken.scope !== 'ALL' && accessToken.scope !== requiredScope) {
      throw new ForbiddenException(`Token does not have ${requiredScope} permission`);
    }

    return { reservationId: accessToken.reservationId };
  }

  /**
   * Mark a token as used (for one-time use scenarios)
   */
  async markUsed(token: string): Promise<void> {
    await this.prisma.client.reservationAccessToken.update({
      where: { token },
      data: { usedAt: new Date() },
    });
  }

  /**
   * Get all tokens for a reservation (for admin view)
   */
  async getTokensForReservation(reservationId: string): Promise<
    Array<{
      id: string;
      scope: string;
      expiresAt: Date;
      usedAt: Date | null;
      createdAt: Date;
    }>
  > {
    return this.prisma.client.reservationAccessToken.findMany({
      where: { reservationId },
      select: {
        id: true,
        scope: true,
        expiresAt: true,
        usedAt: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Revoke all tokens for a reservation
   */
  async revokeAllTokens(reservationId: string): Promise<number> {
    const result = await this.prisma.client.reservationAccessToken.deleteMany({
      where: { reservationId },
    });
    return result.count;
  }

  /**
   * Cleanup expired tokens (called periodically)
   */
  async cleanupExpiredTokens(): Promise<number> {
    const result = await this.prisma.client.reservationAccessToken.deleteMany({
      where: {
        expiresAt: { lt: new Date() },
      },
    });
    return result.count;
  }
}
