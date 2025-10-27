import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PrismaService } from '../prisma.service';
import { User } from './user.decorator';

@Controller('me')
@UseGuards(AuthGuard('jwt'))
export class MeController {
  constructor(private prisma: PrismaService) {}

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
