import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AttendanceStatus, AttendanceSource, Prisma } from '@chefcloud/db';

interface ClockInData {
  employeeId: string;
  orgId: string;
  branchId: string;
  dutyShiftId?: string;
  source?: AttendanceSource;
  notes?: string;
}

interface ClockOutData {
  employeeId: string;
  orgId: string;
}

interface MarkAbsenceData {
  employeeId: string;
  orgId: string;
  branchId: string;
  date: Date;
  notes?: string;
}

interface RegisterCoverData {
  coveringEmployeeId: string;
  coveredForEmployeeId: string;
  orgId: string;
  branchId: string;
  dutyShiftId: string;
  date: Date;
  notes?: string;
}

@Injectable()
export class AttendanceService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Clock in - creates attendance record with PRESENT status
   * Also creates TimeEntry for backward compatibility
   */
  async clockIn(data: ClockInData, _userId?: string) {
    const { employeeId, orgId, branchId, dutyShiftId, source = AttendanceSource.CLOCK, notes } = data;

    // Verify employee exists and is active
    const employee = await this.prisma.client.employee.findFirst({
      where: { id: employeeId, orgId, status: 'ACTIVE' },
      include: { user: true },
    });

    if (!employee) {
      throw new NotFoundException('Employee not found or inactive');
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Check if already clocked in today
    const existing = await this.prisma.client.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
    });

    if (existing && existing.clockInAt) {
      throw new BadRequestException('Already clocked in today');
    }

    const now = new Date();

    // Create or update attendance record
    const attendance = await this.prisma.client.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      create: {
        employeeId,
        orgId,
        branchId,
        dutyShiftId,
        date: today,
        clockInAt: now,
        status: AttendanceStatus.PRESENT,
        source,
        notes,
      },
      update: {
        clockInAt: now,
        status: AttendanceStatus.PRESENT,
        source,
        notes,
      },
    });

    // Create TimeEntry for backward compatibility (if user linked)
    if (employee.userId) {
      await this.prisma.client.timeEntry.create({
        data: {
          orgId,
          branchId,
          userId: employee.userId,
          clockInAt: now,
          method: source === AttendanceSource.CLOCK ? 'PASSKEY' : 'PASSWORD',
          approved: false,
        },
      });
    }

    return attendance;
  }

  /**
   * Clock out - updates attendance record with clock out time
   * Calculates if late departure (LEFT_EARLY)
   */
  async clockOut(data: ClockOutData) {
    const { employeeId, orgId } = data;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const attendance = await this.prisma.client.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: today,
        },
      },
      include: {
        dutyShift: true,
        employee: { include: { user: true } },
      },
    });

    if (!attendance) {
      throw new NotFoundException('No clock-in record found for today');
    }

    if (attendance.clockOutAt) {
      throw new BadRequestException('Already clocked out today');
    }

    const now = new Date();

    // Determine if left early
    let status = attendance.status;
    if (attendance.dutyShift && now < attendance.dutyShift.endsAt) {
      // Left before shift end
      status = AttendanceStatus.LEFT_EARLY;
    }

    // Update attendance
    const updated = await this.prisma.client.attendanceRecord.update({
      where: { id: attendance.id },
      data: {
        clockOutAt: now,
        status,
      },
    });

    // Update TimeEntry for backward compatibility
    if (attendance.employee.userId) {
      const timeEntry = await this.prisma.client.timeEntry.findFirst({
        where: {
          userId: attendance.employee.userId,
          clockInAt: { gte: today },
          clockOutAt: null,
        },
        orderBy: { clockInAt: 'desc' },
      });

      if (timeEntry) {
        const durationMinutes = Math.floor((now.getTime() - timeEntry.clockInAt.getTime()) / 60000);
        const orgSettings = await this.prisma.client.orgSettings.findUnique({
          where: { orgId },
        });
        const overtimeThreshold = (orgSettings?.metadata as any)?.overtimeThresholdMinutes || 480; // 8 hours default
        const overtimeMinutes = Math.max(0, durationMinutes - overtimeThreshold);

        await this.prisma.client.timeEntry.update({
          where: { id: timeEntry.id },
          data: {
            clockOutAt: now,
            overtimeMinutes,
          },
        });
      }
    }

    return updated;
  }

  /**
   * Mark absence - records employee didn't show up for scheduled shift
   */
  async markAbsence(data: MarkAbsenceData, _markedById: string) {
    const { employeeId, orgId, branchId, date, notes } = data;

    // Normalize date
    const absenceDate = new Date(date);
    absenceDate.setHours(0, 0, 0, 0);

    // Check if already recorded
    const existing = await this.prisma.client.attendanceRecord.findUnique({
      where: {
        employeeId_date: {
          employeeId,
          date: absenceDate,
        },
      },
    });

    if (existing && existing.status !== AttendanceStatus.ABSENT) {
      throw new BadRequestException(`Attendance already recorded as ${existing.status}`);
    }

    // Find scheduled shift for this date
    const dutyShift = await this.prisma.client.dutyShift.findFirst({
      where: {
        userId: employeeId,
        startsAt: {
          gte: absenceDate,
          lt: new Date(absenceDate.getTime() + 24 * 60 * 60 * 1000),
        },
      },
    });

    return await this.prisma.client.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId,
          date: absenceDate,
        },
      },
      create: {
        employeeId,
        orgId,
        branchId,
        dutyShiftId: dutyShift?.id,
        date: absenceDate,
        status: AttendanceStatus.ABSENT,
        source: AttendanceSource.MANUAL,
        notes: notes || `Marked absent by manager`,
      },
      update: {
        status: AttendanceStatus.ABSENT,
        notes: notes || `Marked absent by manager`,
      },
    });
  }

  /**
   * Register cover shift - employee B covered for employee A
   */
  async registerCover(data: RegisterCoverData, _registeredById: string) {
    const { coveringEmployeeId, coveredForEmployeeId, orgId, branchId, dutyShiftId, date, notes } = data;

    const coverDate = new Date(date);
    coverDate.setHours(0, 0, 0, 0);

    // Verify both employees exist
    const [coveringEmployee, coveredEmployee] = await Promise.all([
      this.prisma.client.employee.findFirst({
        where: { id: coveringEmployeeId, orgId, status: 'ACTIVE' },
      }),
      this.prisma.client.employee.findFirst({
        where: { id: coveredForEmployeeId, orgId },
      }),
    ]);

    if (!coveringEmployee) {
      throw new NotFoundException('Covering employee not found or inactive');
    }
    if (!coveredEmployee) {
      throw new NotFoundException('Covered employee not found');
    }

    // Mark original employee as covered
    await this.prisma.client.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: coveredForEmployeeId,
          date: coverDate,
        },
      },
      create: {
        employeeId: coveredForEmployeeId,
        orgId,
        branchId,
        dutyShiftId,
        date: coverDate,
        status: AttendanceStatus.COVERED,
        source: AttendanceSource.MANUAL,
        notes: `Covered by ${coveringEmployee.firstName} ${coveringEmployee.lastName}`,
      },
      update: {
        status: AttendanceStatus.COVERED,
        coveredForEmployeeId: null,
      },
    });

    // Record covering employee's attendance
    return await this.prisma.client.attendanceRecord.upsert({
      where: {
        employeeId_date: {
          employeeId: coveringEmployeeId,
          date: coverDate,
        },
      },
      create: {
        employeeId: coveringEmployeeId,
        orgId,
        branchId,
        dutyShiftId,
        date: coverDate,
        status: AttendanceStatus.PRESENT,
        coveredForEmployeeId,
        source: AttendanceSource.MANUAL,
        notes: notes || `Covered for ${coveredEmployee.firstName} ${coveredEmployee.lastName}`,
      },
      update: {
        status: AttendanceStatus.PRESENT,
        coveredForEmployeeId,
        notes: notes || `Covered for ${coveredEmployee.firstName} ${coveredEmployee.lastName}`,
      },
    });
  }

  /**
   * Query attendance records with filters
   */
  async queryAttendance(filters: {
    orgId: string;
    branchId?: string;
    employeeId?: string;
    dateFrom?: Date;
    dateTo?: Date;
    status?: AttendanceStatus;
  }) {
    const where: Prisma.AttendanceRecordWhereInput = {
      orgId: filters.orgId,
    };

    if (filters.branchId) {
      where.branchId = filters.branchId;
    }

    if (filters.employeeId) {
      where.employeeId = filters.employeeId;
    }

    if (filters.dateFrom || filters.dateTo) {
      where.date = {};
      if (filters.dateFrom) {
        where.date.gte = filters.dateFrom;
      }
      if (filters.dateTo) {
        where.date.lte = filters.dateTo;
      }
    }

    if (filters.status) {
      where.status = filters.status;
    }

    return await this.prisma.client.attendanceRecord.findMany({
      where,
      include: {
        employee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
            position: true,
          },
        },
        dutyShift: {
          select: {
            id: true,
            startsAt: true,
            endsAt: true,
            roleSlug: true,
          },
        },
        coveredForEmployee: {
          select: {
            id: true,
            employeeCode: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });
  }

  /**
   * Get attendance summary for payroll
   */
  async getAttendanceSummary(
    orgId: string,
    employeeId: string,
    dateFrom: Date,
    dateTo: Date,
  ): Promise<{
    daysPresent: number;
    daysAbsent: number;
    daysLate: number;
    daysLeftEarly: number;
    daysCovered: number;
    totalMinutesWorked: number;
    overtimeMinutes: number;
  }> {
    const records = await this.prisma.client.attendanceRecord.findMany({
      where: {
        employeeId,
        orgId,
        date: {
          gte: dateFrom,
          lte: dateTo,
        },
      },
    });

    let daysPresent = 0;
    let daysAbsent = 0;
    let daysLate = 0;
    let daysLeftEarly = 0;
    let daysCovered = 0;
    let totalMinutesWorked = 0;
    let overtimeMinutes = 0;

    for (const record of records) {
      switch (record.status) {
        case AttendanceStatus.PRESENT:
          daysPresent++;
          break;
        case AttendanceStatus.ABSENT:
          daysAbsent++;
          break;
        case AttendanceStatus.LATE:
          daysPresent++;
          daysLate++;
          break;
        case AttendanceStatus.LEFT_EARLY:
          daysPresent++;
          daysLeftEarly++;
          break;
        case AttendanceStatus.COVERED:
          daysCovered++;
          break;
      }

      // Calculate minutes worked
      if (record.clockInAt && record.clockOutAt) {
        const minutes = Math.floor(
          (record.clockOutAt.getTime() - record.clockInAt.getTime()) / 60000,
        );
        totalMinutesWorked += minutes;

        // Calculate overtime (> 8 hours per day)
        const dailyOT = Math.max(0, minutes - 480);
        overtimeMinutes += dailyOT;
      }
    }

    return {
      daysPresent,
      daysAbsent,
      daysLate,
      daysLeftEarly,
      daysCovered,
      totalMinutesWorked,
      overtimeMinutes,
    };
  }
}
