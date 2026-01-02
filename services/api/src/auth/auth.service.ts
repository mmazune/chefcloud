import {
  Injectable,
  UnauthorizedException,
  NotFoundException,
  BadRequestException,
  // Inject,
  // forwardRef,
  // Optional,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthHelpers } from './auth.helpers';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse, SessionPlatform } from './dto/auth.dto';
import { JwtPayload } from './jwt.strategy';
// import { WorkforceService } from '../workforce/workforce.service'; // Removed: circular dependency fix M30-OPS-S5
import { SessionInvalidationService } from './session-invalidation.service';
import { SessionsService } from './sessions.service';
import { MsrCardService } from './msr-card.service';
import { SessionSource } from './session-policies';
import { randomBytes } from 'crypto';

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
    // @Optional()
    // @Inject(forwardRef(() => WorkforceService))
    // private workforceService: WorkforceService, // REMOVED: WorkforceModule not imported (circular dependency fix M30-OPS-S5)
    private sessionInvalidation: SessionInvalidationService,
    private sessionsService: SessionsService, // M10: Session lifecycle management
    private msrCardService: MsrCardService, // M10: MSR card management
  ) {}

  async login(loginDto: LoginDto): Promise<AuthResponse> {
    const user = await this.prisma.client.user.findUnique({
      where: { email: loginDto.email },
      include: { org: true, branch: true, employee: true },
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

    // M10: Default platform for password login is WEB_BACKOFFICE
    const platform = loginDto.platform || SessionPlatform.WEB_BACKOFFICE;
    const employeeId = user.employee?.id;

    return this.generateAuthResponse(user, {
      platform,
      source: SessionSource.PASSWORD,
      employeeId,
    });
  }

  async pinLogin(pinLoginDto: PinLoginDto): Promise<AuthResponse> {
    const employeeProfile = await this.prisma.client.employeeProfile.findUnique({
      where: { employeeCode: pinLoginDto.employeeCode },
      include: {
        user: {
          include: { org: true, branch: true, employee: true },
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

    // M10: Default platform for PIN login is POS_DESKTOP
    const platform = pinLoginDto.platform || SessionPlatform.POS_DESKTOP;
    const employeeId = user.employee?.id;

    return this.generateAuthResponse(user, {
      platform,
      source: SessionSource.PIN,
      employeeId,
    });
  }

  async msrSwipe(msrSwipeDto: MsrSwipeDto): Promise<AuthResponse> {
    const rawData = msrSwipeDto.badgeId;

    // SECURITY: Reject PAN-like payment card data
    if (isPanLike(rawData)) {
      throw new BadRequestException('Payment card data rejected');
    }

    // M10: Try new MsrCard model first, fall back to legacy EmployeeProfile.badgeId
    let authResult;
    try {
      authResult = await this.msrCardService.authenticateByCard(rawData);
    } catch (legacyError) {
      // Fall back to legacy badge lookup for backward compatibility
      const badgeCode = parseBadgeCode(rawData);
      if (!badgeCode) {
        throw new BadRequestException('Invalid badge format. Expected: CLOUDBADGE:<CODE>');
      }

      // Check BadgeAsset state enforcement (legacy)
      const badgeAsset = await this.prisma.client.badgeAsset.findUnique({
        where: { code: badgeCode },
      });

      if (badgeAsset) {
        if (badgeAsset.state === 'REVOKED') {
          throw new UnauthorizedException('Badge has been revoked');
        }
        if (badgeAsset.state === 'LOST') {
          throw new UnauthorizedException('Badge reported as lost');
        }

        // Update last used
        await this.prisma.client.badgeAsset.update({
          where: { code: badgeCode },
          data: { lastUsedAt: new Date() },
        });
      }

      // Lookup via EmployeeProfile (legacy)
      const employeeProfile = await this.prisma.client.employeeProfile.findUnique({
        where: { badgeId: badgeCode },
        include: {
          user: {
            include: { org: true, branch: true, employee: true },
          },
        },
      });

      if (!employeeProfile) {
        throw legacyError; // Throw original MsrCard error
      }

      authResult = {
        card: null,
        employee: employeeProfile.user.employee || null,
        user: employeeProfile.user,
      };
    }

    const { user, employee } = authResult;

    // Optionally verify branch if provided
    if (msrSwipeDto.branchId && user.branchId !== msrSwipeDto.branchId) {
      throw new UnauthorizedException('Employee not assigned to this branch');
    }

    // Log auth event
    await this.createAuditEvent(user.id, user.orgId, user.branchId, 'BADGE_LOGIN');

    // E43-s1: Auto-clock-in if enabled
    await this.autoClockIn(user.id, user.orgId, user.branchId, 'MSR');

    // M10: Default platform for MSR login is POS_DESKTOP
    const platform = msrSwipeDto.platform || SessionPlatform.POS_DESKTOP;

    return this.generateAuthResponse(user, {
      platform,
      source: SessionSource.MSR_CARD,
      employeeId: employee?.id,
      badgeId: rawData, // Store raw badge identifier (will be hashed in session if needed)
    });
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

  private async generateAuthResponse(
    user: {
      id: string;
      email: string;
      firstName: string;
      lastName: string;
      roleLevel: string;
      jobRole?: string | null; // M8.1: Job role for role-specific UX
      orgId: string;
      branchId: string | null;
      sessionVersion?: number;
    },
    sessionContext?: {
      platform: SessionPlatform;
      source: SessionSource;
      employeeId?: string;
      badgeId?: string;
      deviceId?: string;
      ipAddress?: string;
      userAgent?: string;
    },
  ): Promise<AuthResponse> {
    // E25: Get current session version
    const sessionVersion =
      user.sessionVersion ?? (await this.sessionInvalidation.getSessionVersion(user.id));

    // E25: Generate unique JWT ID for deny list tracking
    const jti = randomBytes(16).toString('hex');

    // M10: Create session if context provided
    let session;
    if (sessionContext) {
      session = await this.sessionsService.createSession({
        userId: user.id,
        orgId: user.orgId,
        branchId: user.branchId ?? undefined,
        employeeId: sessionContext.employeeId,
        platform: sessionContext.platform,
        source: sessionContext.source,
        deviceId: sessionContext.deviceId,
        badgeId: sessionContext.badgeId,
        ipAddress: sessionContext.ipAddress,
        userAgent: sessionContext.userAgent,
        jti,
      });
    }

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      orgId: user.orgId,
      roleLevel: user.roleLevel,
      ...(user.jobRole && { jobRole: user.jobRole }), // M8.1: Include jobRole if present
      sv: sessionVersion, // E25: Session version
      jti, // E25: JWT ID
      ...(sessionContext?.badgeId && { badgeId: sessionContext.badgeId }), // E25: Include badge ID if authenticated via badge
      ...(session && { sessionId: session.id }), // M10: Session ID for lifecycle tracking
      ...(sessionContext && { platform: sessionContext.platform }), // M10: Platform for enforcement
    };

    return {
      access_token: this.jwtService.sign(payload),
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        roleLevel: user.roleLevel,
        jobRole: user.jobRole ?? undefined, // M8.1: Include jobRole in response
        orgId: user.orgId,
        branchId: user.branchId ?? undefined,
      },
      ...(session && {
        session: {
          id: session.id,
          platform: session.platform,
          expiresAt: session.expiresAt.toISOString(),
        },
      }),
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

  /**
   * E43-s1: Auto-clock-in on MSR/Passkey login if enabled
   */
  private async autoClockIn(
    _userId: string,
    orgId: string,
    _branchId: string | null,
    _method: 'MSR' | 'PASSKEY',
  ): Promise<void> {
    try {
      // Check if auto-clock-in is enabled
      const settings = await this.prisma.client.orgSettings.findUnique({
        where: { orgId },
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const autoClockInOnMsr = (settings?.attendance as any)?.autoClockInOnMsr ?? false;

      if (!autoClockInOnMsr) {
        return; // WorkforceService not available (circular dependency fix M30-OPS-S5)
      }

      // Clock in via WorkforceService (only if available)
      // DISABLED: WorkforceModule not imported to break circular dependency
      // await this.workforceService.clockIn({
      //   orgId,
      //   branchId: branchId || 'default',
      //   userId,
      //   method,
      // });
    } catch (error) {
      // Don't fail auth if clock-in fails (e.g., already clocked in)
      console.log(`Auto-clock-in skipped for user ${_userId}:`, (error as Error).message);
    }
  }
}
