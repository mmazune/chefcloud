/**
 * M10.11: Availability Controller
 * 
 * Endpoints for managing employee availability:
 * - Self-service: /workforce/self/availability
 * - Manager view: /workforce/availability
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { AvailabilityService, AvailabilitySlot, AvailabilityExceptionInput } from './availability.service';

// ===== SELF-SERVICE CONTROLLER =====

@Controller('workforce/self/availability')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class SelfAvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) { }

  /**
   * GET /workforce/self/availability
   * Get my weekly availability slots
   */
  @Get()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyAvailability(@Request() req: any) {
    return this.availabilityService.getMyAvailability(req.user.userId, req.user.orgId);
  }

  /**
   * PUT /workforce/self/availability
   * Set my weekly availability (replaces all existing)
   */
  @Put()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async setMyAvailability(
    @Body() body: { slots: AvailabilitySlot[] },
    @Request() req: any,
  ) {
    return this.availabilityService.setMyAvailability(
      req.user.userId,
      req.user.orgId,
      body.slots,
    );
  }

  /**
   * GET /workforce/self/availability/exceptions
   * Get my availability exceptions
   */
  @Get('exceptions')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyExceptions(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Request() req?: any,
  ) {
    return this.availabilityService.getMyExceptions(
      req.user.userId,
      req.user.orgId,
      from ? new Date(from) : undefined,
      to ? new Date(to) : undefined,
    );
  }

  /**
   * POST /workforce/self/availability/exceptions
   * Add an availability exception
   */
  @Post('exceptions')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async addMyException(
    @Body() body: {
      date: string;
      isAvailable: boolean;
      startTime?: string;
      endTime?: string;
      reason?: string;
    },
    @Request() req: any,
  ) {
    const input: AvailabilityExceptionInput = {
      date: new Date(body.date),
      isAvailable: body.isAvailable,
      startTime: body.startTime,
      endTime: body.endTime,
      reason: body.reason,
    };
    return this.availabilityService.addMyException(req.user.userId, req.user.orgId, input);
  }

  /**
   * PUT /workforce/self/availability/exceptions/:id
   * Update an availability exception
   */
  @Put('exceptions/:id')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async updateMyException(
    @Param('id') id: string,
    @Body() body: {
      isAvailable?: boolean;
      startTime?: string;
      endTime?: string;
      reason?: string;
    },
    @Request() req: any,
  ) {
    return this.availabilityService.updateMyException(
      req.user.userId,
      req.user.orgId,
      id,
      body,
    );
  }

  /**
   * DELETE /workforce/self/availability/exceptions/:id
   * Delete an availability exception
   */
  @Delete('exceptions/:id')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async deleteMyException(
    @Param('id') id: string,
    @Request() req: any,
  ) {
    return this.availabilityService.deleteMyException(req.user.userId, req.user.orgId, id);
  }

  /**
   * GET /workforce/self/availability/effective
   * Get effective availability for a specific date
   */
  @Get('effective')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async getMyEffectiveAvailability(
    @Query('date') date: string,
    @Request() req: any,
  ) {
    return this.availabilityService.getEffectiveAvailability(
      req.user.userId,
      req.user.orgId,
      new Date(date),
    );
  }
}

// ===== MANAGER CONTROLLER =====

@Controller('workforce/availability')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class AvailabilityController {
  constructor(private readonly availabilityService: AvailabilityService) { }

  /**
   * GET /workforce/availability/team
   * Get availability for all team members in a date range
   */
  @Get('team')
  @Roles('L3', 'L4', 'L5')
  async getTeamAvailability(
    @Query('branchId') branchId: string,
    @Query('from') from: string,
    @Query('to') to: string,
    @Request() req: any,
  ) {
    return this.availabilityService.getTeamAvailability(
      req.user.orgId,
      branchId || null,
      new Date(from),
      new Date(to),
    );
  }

  /**
   * GET /workforce/availability/:userId
   * Get availability for a specific employee
   */
  @Get(':userId')
  @Roles('L3', 'L4', 'L5')
  async getEmployeeAvailability(
    @Param('userId') userId: string,
    @Request() req: any,
  ) {
    return this.availabilityService.getEmployeeAvailability(req.user.orgId, userId);
  }

  /**
   * PUT /workforce/availability/:userId
   * Set availability for a specific employee (manager override)
   */
  @Put(':userId')
  @Roles('L3', 'L4', 'L5')
  async setEmployeeAvailability(
    @Param('userId') userId: string,
    @Body() body: { slots: AvailabilitySlot[] },
    @Request() req: any,
  ) {
    return this.availabilityService.setEmployeeAvailability(
      req.user.orgId,
      userId,
      body.slots,
      req.user.userId,
    );
  }

  /**
   * GET /workforce/availability/:userId/effective
   * Get effective availability for an employee on a specific date
   */
  @Get(':userId/effective')
  @Roles('L3', 'L4', 'L5')
  async getEmployeeEffectiveAvailability(
    @Param('userId') userId: string,
    @Query('date') date: string,
    @Request() req: any,
  ) {
    return this.availabilityService.getEffectiveAvailability(
      userId,
      req.user.orgId,
      new Date(date),
    );
  }
}
