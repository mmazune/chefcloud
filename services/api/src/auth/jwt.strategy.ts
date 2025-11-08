import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../prisma.service';
import { SessionInvalidationService } from './session-invalidation.service';

export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
  roleLevel: string;
  sv?: number;      // E25: Session version for revocation
  badgeId?: string; // E25: Badge ID if authenticated via badge swipe
  jti?: string;     // E25: JWT ID for deny list lookup
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    private prisma: PrismaService,
    private sessionInvalidation: SessionInvalidationService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'dev-secret-change-in-production',
      passReqToCallback: true, // E25: Pass request to extract full token for deny list check
    });
  }

  async validate(_request: any, payload: JwtPayload) {
    // E25: Check if token is in deny list (immediate invalidation)
    if (payload.jti) {
      const isDenied = await this.sessionInvalidation.isDenied(payload.jti);
      if (isDenied) {
        throw new UnauthorizedException('Session has been revoked');
      }
    }

    const user = await this.prisma.client.user.findUnique({
      where: { id: payload.sub },
      include: {
        branch: true,
        org: true,
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // E25: Validate session version - reject if token has old version
    if (payload.sv !== undefined && payload.sv !== user.sessionVersion) {
      throw new UnauthorizedException('Session has been invalidated due to security event');
    }

    return {
      userId: user.id,
      email: user.email,
      orgId: user.orgId,
      branchId: user.branchId,
      roleLevel: user.roleLevel,
      org: user.org,
      branch: user.branch,
    };
  }
}
