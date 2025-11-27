import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { AttendanceService } from './attendance.service';
import { Roles } from '../auth/roles.decorator';
import { RolesGuard } from '../auth/roles.guard';
import { AttendanceStatus, AttendanceSource } from '@chefcloud/db';

@Controller('hr/attendance')
@UseGuards(RolesGuard)
export class AttendanceController {
  constructor(private readonly attendanceService: AttendanceService) {}

  /**
   * Clock in - staff can self-clock, managers can clock in for others
   */
  @Post('clock-in')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async clockIn(
    @Body()
    body: {
      employeeId: string;
      orgId: string;
      branchId: string;
      dutyShiftId?: string;
      source?: AttendanceSource;
      notes?: string;
    },
    @Req() _req: any,
  ) {
    return await this.attendanceService.clockIn(body);
  }

  /**
   * Clock out - staff can self-clock out
   */
  @Post('clock-out')
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async clockOut(
    @Body()
    body: {
      employeeId: string;
      orgId: string;
    },
  ) {
    return await this.attendanceService.clockOut(body);
  }

  /**
   * Mark absence - managers only (L3+)
   */
  @Post('mark-absence')
  @Roles('L3', 'L4', 'L5')
  async markAbsence(
    @Body()
    body: {
      employeeId: string;
      orgId: string;
      branchId: string;
      date: string;
      notes?: string;
    },
    @Req() req: any,
  ) {
    return await this.attendanceService.markAbsence(
      {
        ...body,
        date: new Date(body.date),
      },
      req.user.id,
    );
  }

  /**
   * Register cover shift - managers only (L3+)
   */
  @Post('register-cover')
  @Roles('L3', 'L4', 'L5')
  async registerCover(
    @Body()
    body: {
      coveringEmployeeId: string;
      coveredForEmployeeId: string;
      orgId: string;
      branchId: string;
      dutyShiftId: string;
      date: string;
      notes?: string;
    },
    @Req() req: any,
  ) {
    return await this.attendanceService.registerCover(
      {
        ...body,
        date: new Date(body.date),
      },
      req.user.id,
    );
  }

  /**
   * Query attendance - staff can see own, managers can see all in branch (L3+), accountants all (L4+)
   */
  @Get()
  @Roles('L1', 'L2', 'L3', 'L4', 'L5')
  async queryAttendance(
    @Req() req: any,
    @Query('orgId') orgId?: string,
    @Query('branchId') branchId?: string,
    @Query('employeeId') employeeId?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
    @Query('status') status?: AttendanceStatus,
  ) {
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }

    // L1-L2 can only see their own
    const userRole = req.user.roleLevel;
    if ((userRole === 'L1' || userRole === 'L2') && employeeId !== req.user.employeeId) {
      throw new BadRequestException('Staff can only view their own attendance');
    }

    return await this.attendanceService.queryAttendance({
      orgId,
      branchId,
      employeeId,
      dateFrom: dateFrom ? new Date(dateFrom) : undefined,
      dateTo: dateTo ? new Date(dateTo) : undefined,
      status,
    });
  }

  /**
   * Get attendance summary - for payroll (L4+ only)
   */
  @Get('summary')
  @Roles('L4', 'L5')
  async getAttendanceSummary(
    @Query('orgId') orgId: string,
    @Query('employeeId') employeeId: string,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
  ) {
    if (!orgId || !employeeId || !dateFrom || !dateTo) {
      throw new BadRequestException('orgId, employeeId, dateFrom, and dateTo are required');
    }

    return await this.attendanceService.getAttendanceSummary(
      orgId,
      employeeId,
      new Date(dateFrom),
      new Date(dateTo),
    );
  }

  /**
   * Get today's attendance summary - for dashboard (L3+)
   */
  @Get('today-summary')
  @Roles('L3', 'L4', 'L5')
  async getTodaySummary(
    @Query('orgId') orgId: string,
    @Query('branchId') branchId?: string,
  ) {
    if (!orgId) {
      throw new BadRequestException('orgId is required');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Get all employees for the org/branch
    const employeeWhere: any = { orgId };
    if (branchId) {
      employeeWhere.branchId = branchId;
    }
    const totalEmployees = await this.attendanceService['prisma'].client.employee.count({
      where: employeeWhere,
    });

    // Get today's attendance records
    const attendanceWhere: any = {
      orgId,
      date: { gte: today, lt: tomorrow },
    };
    if (branchId) {
      attendanceWhere.branchId = branchId;
    }

    const records = await this.attendanceService['prisma'].client.attendance.findMany({
      where: attendanceWhere,
    });

    const presentToday = records.filter((r) => r.status === AttendanceStatus.PRESENT).length;
    const absentToday = records.filter((r) => r.status === AttendanceStatus.ABSENT).length;
    const lateToday = records.filter((r) => r.status === AttendanceStatus.LATE).length;

    return {
      totalEmployees,
      presentToday,
      absentToday,
      lateToday,
    };
  }
}
