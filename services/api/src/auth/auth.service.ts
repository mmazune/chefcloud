import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma.service';
import { AuthHelpers } from './auth.helpers';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse } from './dto/auth.dto';
import { JwtPayload } from './jwt.strategy';

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
    const employeeProfile = await this.prisma.client.employeeProfile.findUnique({
      where: { badgeId: msrSwipeDto.badgeId },
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

    // Log auth event
    await this.createAuditEvent(user.id, user.orgId, user.branchId, 'auth.msr_swipe');

    return this.generateAuthResponse(user);
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
    _metadata?: Record<string, unknown>,
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
          },
        },
      });
    } catch (error) {
      // Log error but don't fail the auth request
      console.error('Failed to create audit event:', error);
    }
  }
}
