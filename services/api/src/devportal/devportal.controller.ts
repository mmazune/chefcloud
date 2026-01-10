/**
 * DevPortal Controller
 * 
 * Developer endpoints for diagnostics and status.
 * ALL routes require:
 * - Valid JWT authentication
 * - L5 (OWNER) role
 * 
 * @security Strict owner-only access. Disabled by default (DEVPORTAL_ENABLED !== '1')
 */
import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { DevPortalService, DevPortalStatus } from './devportal.service';

@ApiTags('dev')
@ApiBearerAuth()
@Controller('dev')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class DevPortalController {
  constructor(private readonly devPortalService: DevPortalService) {}

  /**
   * GET /dev/status
   * Returns current DevPortal status and environment info.
   */
  @Get('status')
  @Roles('L5') // OWNER only
  @ApiOperation({ summary: 'Get DevPortal status (OWNER only)' })
  @ApiResponse({ status: 200, description: 'DevPortal status' })
  @ApiResponse({ status: 401, description: 'Not authenticated' })
  @ApiResponse({ status: 403, description: 'Not authorized (requires OWNER role)' })
  getStatus(): DevPortalStatus {
    return this.devPortalService.getStatus();
  }
}
