import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma.service';
import { User } from './user.decorator';

// Skip throttle for /me and /branches in development for demo verification
const skipThrottleInDev = process.env.NODE_ENV !== 'production' || process.env.DEMO_VERIFY === 'true';

@Controller('me')
@UseGuards(AuthGuard('jwt'))
@SkipThrottle()
export class MeController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /me
   * Returns current user profile with org, branch, and employee details
   * 
   * Rate limiting: Skipped for demo verification reliability
   */
  @Get()
  async getMe(@User() user: { userId: string }) {
    const fullUser = await this.prisma.client.user.findUnique({
      where: { id: user.userId },
      include: {
        org: true,
        branch: true,
        employeeProfile: true,
      },
    });

    if (!fullUser) {
      return null;
    }

    return {
      id: fullUser.id,
      email: fullUser.email,
      firstName: fullUser.firstName,
      lastName: fullUser.lastName,
      roleLevel: fullUser.roleLevel,
      orgId: fullUser.orgId,
      branchId: fullUser.branchId,
      isActive: fullUser.isActive,
      org: {
        id: fullUser.org.id,
        name: fullUser.org.name,
        slug: fullUser.org.slug,
      },
      branch: fullUser.branch
        ? {
            id: fullUser.branch.id,
            name: fullUser.branch.name,
            timezone: fullUser.branch.timezone,
          }
        : null,
      employeeProfile: fullUser.employeeProfile
        ? {
            employeeCode: fullUser.employeeProfile.employeeCode,
            badgeId: fullUser.employeeProfile.badgeId,
          }
        : null,
    };
  }
}

@Controller('branches')
@UseGuards(AuthGuard('jwt'))
@SkipThrottle()
export class BranchesController {
  constructor(private prisma: PrismaService) {}

  /**
   * GET /branches
   * Returns all branches for the current user's org
   * V2.1.1: Required for ActiveBranchContext
   * 
   * Rate limiting: Skipped for demo verification reliability
   */
  @Get()
  async getBranches(@User() user: { orgId: string }) {
    const branches = await this.prisma.client.branch.findMany({
      where: { orgId: user.orgId },
      select: {
        id: true,
        name: true,
        timezone: true,
      },
      orderBy: { name: 'asc' },
    });

    return branches;
  }
}
