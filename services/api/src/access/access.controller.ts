import { Controller, Get, Patch, Post, Body, UseGuards, Request } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AccessService } from './access.service';

interface PlatformAccess {
  desktop: boolean;
  web: boolean;
  mobile: boolean;
}

@Controller('access')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AccessController {
  constructor(private readonly accessService: AccessService) {}

  /**
   * GET /access/matrix
   * Retrieve the platform access matrix for the user's organization.
   * Requires L4+ role.
   */
  @Get('matrix')
  @Roles('L4')
  async getMatrix(@Request() req: { user: { orgId: string } }) {
    const orgId = req.user.orgId;
    return this.accessService.getMatrix(orgId);
  }

  /**
   * PATCH /access/matrix
   * Update the platform access matrix for the user's organization.
   * Requires L4+ role.
   *
   * Body: { "ROLE_NAME": { "desktop": bool, "web": bool, "mobile": bool }, ... }
   */
  @Patch('matrix')
  @Roles('L4')
  async patchMatrix(
    @Request() req: { user: { orgId: string } },
    @Body() updates: Record<string, PlatformAccess>,
  ) {
    const orgId = req.user.orgId;
    return this.accessService.patchMatrix(orgId, updates);
  }

  /**
   * POST /access/matrix/reset-defaults
   * Reset the platform access matrix to recommended defaults.
   * Requires L5 (Owner) role.
   */
  @Post('matrix/reset-defaults')
  @Roles('L5')
  async resetToDefaults(@Request() req: { user: { orgId: string; id: string } }) {
    const { orgId, id: userId } = req.user;
    return this.accessService.resetToDefaults(orgId, userId);
  }
}
