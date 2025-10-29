import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthHelpers } from './auth.helpers';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse } from './dto/auth.dto';
import { JwtPayload } from './jwt.strategy';

/**
 * Detect PAN-like track data (payment card).
 * Rejects Track 1 (%B...) and Track 2 (;digits=...) formats.
 */
export function isPanLike(trackData: string): boolean {
  // Track 2: ;1234567890123456=...
  // Track 1: %B1234567890123456^...
  const track1Pattern = /^%B\d{12,19}\^/;
  const track2Pattern = /^;?\d{12,19}=/;

  return track1Pattern.test(trackData) || track2Pattern.test(trackData);
}

/**
 * Parse CLOUDBADGE format: "CLOUDBADGE:<CODE>"
 * Returns CODE if valid, null otherwise.
 */
export function parseBadgeCode(trackData: string): string | null {
  const match = trackData.match(/^CLOUDBADGE:([A-Za-z0-9_-]+)$/);
  return match ? match[1] : null;
}

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: loginDto.email },
      include: { org: true, branch: true },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await AuthHelpers.verifyPassword(user.passwordHash, loginDto.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Log auth event
    await this.createAuditEvent(user.id, user.orgId, user.branchId, 'auth.login');

    return this.generateAuthResponse(user);
  }

  async pinLogin(pinLoginDto: PinLoginDto): Promise<AuthResponse> {
    const employeeProfile = await this.prisma.client.employeeProfile.findUnique({
      where: { employeeCode: pinLoginDto.employeeCode },
      include: {
        user: {
          include: { org: true, branch: true },
        },
      },
    });

    if (!employeeProfile || !employeeProfile.user.pinHash) {
      throw new UnauthorizedException('Invalid employee code or PIN not set');
    }

    const user = employeeProfile.user;

    // Verify branch matches
    if (user.branchId !== pinLoginDto.branchId) {
      throw new UnauthorizedException('Employee not assigned to this branch');
    }

    // Verify PIN
    if (!user.pinHash) {
      throw new UnauthorizedException('PIN not set for this employee');
    }
    const isPinValid = await AuthHelpers.verifyPin(user.pinHash, pinLoginDto.pin);

    if (!isPinValid) {
      throw new UnauthorizedException('Invalid PIN');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Log auth event
    await this.createAuditEvent(user.id, user.orgId, user.branchId, 'auth.pin_login');

    return this.generateAuthResponse(user);
  }

  async msrSwipe(msrSwipeDto: MsrSwipeDto): Promise<AuthResponse> {
    const rawData = msrSwipeDto.badgeId;

    // SECURITY: Reject PAN-like payment card data
    if (isPanLike(rawData)) {
      throw new BadRequestException('Payment card data rejected');
    }

    // Parse CLOUDBADGE format
    const badgeCode = parseBadgeCode(rawData);
    if (!badgeCode) {
      throw new BadRequestException('Invalid badge format. Expected: CLOUDBADGE:<CODE>');
    }

    // Check BadgeAsset state enforcement
    const badgeAsset = await this.prisma.client.badgeAsset.findUnique({
      where: { code: badgeCode },
    });

    if (badgeAsset) {
      // Deny if badge is REVOKED or LOST
      if (badgeAsset.state === 'REVOKED') {
        throw new UnauthorizedException('Badge has been revoked');
      }
      if (badgeAsset.state === 'LOST') {
        throw new UnauthorizedException('Badge reported as lost');
      }
    }

    const employeeProfile = await this.prisma.client.employeeProfile.findUnique({
      where: { badgeId: badgeCode },
      include: {
        user: {
          include: { org: true, branch: true },
        },
      },
    });

    if (!employeeProfile) {
      throw new NotFoundException('Badge ID not found');
    }

    const user = employeeProfile.user;

    if (!user.isActive) {
      throw new UnauthorizedException('User account is disabled');
    }

    // Optionally verify branch if provided
    if (msrSwipeDto.branchId && user.branchId !== msrSwipeDto.branchId) {
      throw new UnauthorizedException('Employee not assigned to this branch');
    }

    // Update BadgeAsset lastUsedAt on successful login
    if (badgeAsset) {
      await this.prisma.client.badgeAsset.update({
        where: { code: badgeCode },
        data: { lastUsedAt: new Date() },
      });
    }

    // Log auth event
    await this.createAuditEvent(user.id, user.orgId, user.branchId, 'BADGE_LOGIN');

    return this.generateAuthResponse(user);
  }

  async enrollBadge(
    userId: string,
    badgeId: string,
    requestingUserId: string,
  ): Promise<{ success: boolean }> {
    // Validate badge format (alphanumeric, underscore, hyphen only)
    if (!/^[A-Za-z0-9_-]+$/.test(badgeId)) {
      throw new BadRequestException('Badge ID must be alphanumeric (A-Z, 0-9, _, -)');
    }

    // Check if badge already exists
    const existing = await this.prisma.client.employeeProfile.findUnique({
      where: { badgeId },
    });

    if (existing && existing.userId !== userId) {
      throw new BadRequestException('Badge ID already assigned to another user');
    }

    // Find or create employee profile
    const user = await this.prisma.client.user.findUnique({
      where: { id: userId },
      include: { employeeProfile: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.employeeProfile) {
      // Update existing profile
      await this.prisma.client.employeeProfile.update({
        where: { id: user.employeeProfile.id },
        data: { badgeId },
      });
    } else {
      // Create new employee profile with auto-generated employee code
      const employeeCode = `EMP-${Date.now()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
      await this.prisma.client.employeeProfile.create({
        data: {
          userId,
          employeeCode,
          badgeId,
        },
      });
    }

    // Audit event
    await this.createAuditEvent(requestingUserId, user.orgId, user.branchId, 'BADGE_ENROLL', {
      enrolledUserId: userId,
      badgeId,
    });

    return { success: true };
  }

  private generateAuthResponse(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    roleLevel: string;
    orgId: string;
    branchId: string | null;
  }): AuthResponse {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.orgId,
      roleLevel: user.roleLevel,
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleLevel: user.roleLevel,
        orgId: user.orgId,
        branchId: user.branchId ?? undefined,
      },
    };
  }

  private async createAuditEvent(
    userId: string,
    _orgId: string,
    branchId: string | null,
    action: string,
    metadata?: Record<string, unknown>,
  ): Promise<void> {
    if (!branchId) {
      // Skip audit if no branch (shouldn't happen in normal flow)
      return;
    }

    try {
      await this.prisma.client.auditEvent.create({
        data: {
          userId,
          branchId,
          action,
          resource: 'auth',
          metadata: {
            timestamp: new Date().toISOString(),
            userAgent: 'api',
            ...metadata,
          },
        },
      });
    } catch (error) {
      // Log error but don't fail the auth request
      console.error('Failed to create audit event:', error);
    }
  }
}
