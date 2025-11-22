/**
 * M9: Payroll Engine Service
 *
 * Enhanced payroll calculation supporting:
 * - MONTHLY salary with absence deductions
 * - DAILY salary (pay per day worked)
 * - HOURLY salary (existing logic)
 * - PER_SHIFT salary (pay per shift completed)
 */

import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { AttendanceService } from '../hr/attendance.service';
import { SalaryType } from '@chefcloud/db';

interface PayrollCalculation {
  gross: number;
  absenceDeductions: number;
  daysPresent: number;
  daysAbsent: number;
  regularMinutes: number;
  overtimeMinutes: number;
  metadata: any;
}

@Injectable()
export class PayrollEngineService {
  // private readonly logger = new Logger(PayrollEngineService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly attendanceService: AttendanceService,
  ) {}

  /**
   * Calculate payslip for an employee based on their contract type
   */
  async calculatePayslip(
    orgId: string,
    employeeId: string,
    periodStart: Date,
    periodEnd: Date,
  ): Promise<PayrollCalculation> {
    // Get employee and active contract
    const employee = await this.prisma.client.employee.findFirst({
      where: { id: employeeId, orgId },
      include: {
        contracts: {
          where: {
            isPrimary: true,
            startDate: { lte: periodEnd },
            OR: [{ endDate: null }, { endDate: { gte: periodStart } }],
          },
          take: 1,
        },
        user: {
          include: {
            employeeProfile: true,
          },
        },
      },
    });

    if (!employee) {
      throw new BadRequestException(`Employee ${employeeId} not found`);
    }

    const contract = employee.contracts[0];
    if (!contract) {
      throw new BadRequestException(
        `No active employment contract for employee ${employeeId}`,
      );
    }

    // Get attendance summary
    const attendance = await this.attendanceService.getAttendanceSummary(
      orgId,
      employeeId,
      periodStart,
      periodEnd,
    );

    // Calculate based on salary type
    switch (contract.salaryType) {
      case SalaryType.MONTHLY:
        return this.calculateMonthly(contract, attendance, periodStart, periodEnd);
      case SalaryType.DAILY:
        return this.calculateDaily(contract, attendance);
      case SalaryType.HOURLY:
        return this.calculateHourly(contract, attendance);
      case SalaryType.PER_SHIFT:
        return this.calculatePerShift(contract, attendance, employeeId, periodStart, periodEnd);
      default:
        throw new BadRequestException(`Unsupported salary type: ${contract.salaryType}`);
    }
  }

  /**
   * MONTHLY salary: Fixed monthly amount with deductions for absences
   */
  private calculateMonthly(
    contract: any,
    attendance: any,
    periodStart: Date,
    periodEnd: Date,
  ): PayrollCalculation {
    const baseSalary = Number(contract.baseSalary);
    const workingDaysPerMonth = contract.workingDaysPerMonth || 22;

    // Calculate deduction rule
    const deductionRule = contract.deductionRule as any;
    const dailyRate = deductionRule?.dailyRate || baseSalary / workingDaysPerMonth;

    // Calculate working days in period
    const daysInPeriod = Math.floor(
      (periodEnd.getTime() - periodStart.getTime()) / (24 * 60 * 60 * 1000),
    ) + 1;

    // Prorate for partial month
    const expectedDays = Math.min(daysInPeriod, workingDaysPerMonth);

    // Calculate gross: base - (dailyRate * daysAbsent)
    const absenceDeductions = dailyRate * attendance.daysAbsent;
    const gross = baseSalary - absenceDeductions;

    // Add overtime pay if applicable
    const overtimeRate = Number(contract.overtimeRate);
    const hourlyRate = deductionRule?.hourlyRate || baseSalary / (workingDaysPerMonth * 8);
    const overtimePay = (attendance.overtimeMinutes / 60) * hourlyRate * overtimeRate;

    return {
      gross: Math.round((gross + overtimePay) * 100) / 100,
      absenceDeductions: Math.round(absenceDeductions * 100) / 100,
      daysPresent: attendance.daysPresent,
      daysAbsent: attendance.daysAbsent,
      regularMinutes: 0, // N/A for monthly
      overtimeMinutes: attendance.overtimeMinutes,
      metadata: {
        salaryType: 'MONTHLY',
        baseSalary,
        dailyRate,
        hourlyRate,
        overtimeRate,
        expectedDays,
        workingDaysPerMonth,
        overtimePay,
      },
    };
  }

  /**
   * DAILY salary: Pay per day worked
   */
  private calculateDaily(contract: any, attendance: any): PayrollCalculation {
    const dailyRate = Number(contract.baseSalary);
    const overtimeRate = Number(contract.overtimeRate);
    const workingHoursPerDay = contract.workingHoursPerDay || 8;
    const hourlyRate = dailyRate / workingHoursPerDay;

    // Base pay = dailyRate * daysPresent
    const basePay = dailyRate * attendance.daysPresent;

    // Overtime pay
    const overtimePay = (attendance.overtimeMinutes / 60) * hourlyRate * overtimeRate;

    return {
      gross: Math.round((basePay + overtimePay) * 100) / 100,
      absenceDeductions: 0, // Not applicable for daily pay
      daysPresent: attendance.daysPresent,
      daysAbsent: attendance.daysAbsent,
      regularMinutes: 0,
      overtimeMinutes: attendance.overtimeMinutes,
      metadata: {
        salaryType: 'DAILY',
        dailyRate,
        hourlyRate,
        overtimeRate,
        basePay,
        overtimePay,
      },
    };
  }

  /**
   * HOURLY salary: Existing hourly rate logic
   */
  private calculateHourly(contract: any, attendance: any): PayrollCalculation {
    const hourlyRate = Number(contract.baseSalary);
    const overtimeRate = Number(contract.overtimeRate);

    // Regular pay
    const regularPay = (attendance.totalMinutesWorked / 60) * hourlyRate;

    // Overtime pay (already calculated in attendance, but recalc for accuracy)
    const regularMinutes = attendance.totalMinutesWorked - attendance.overtimeMinutes;
    const overtimePay = (attendance.overtimeMinutes / 60) * hourlyRate * overtimeRate;

    return {
      gross: Math.round((regularPay + overtimePay) * 100) / 100,
      absenceDeductions: 0,
      daysPresent: attendance.daysPresent,
      daysAbsent: attendance.daysAbsent,
      regularMinutes,
      overtimeMinutes: attendance.overtimeMinutes,
      metadata: {
        salaryType: 'HOURLY',
        hourlyRate,
        overtimeRate,
        regularPay,
        overtimePay,
      },
    };
  }

  /**
   * PER_SHIFT salary: Pay per shift completed
   */
  private async calculatePerShift(
    contract: any,
    attendance: any,
    _employeeId: string,
    _periodStart: Date,
    _periodEnd: Date,
  ): Promise<PayrollCalculation> {
    const shiftRate = Number(contract.baseSalary);
    const overtimeRate = Number(contract.overtimeRate);
    const workingHoursPerShift = contract.workingHoursPerDay || 8;
    const hourlyRate = shiftRate / workingHoursPerShift;

    // Count completed shifts (shifts where employee was present)
    const shiftsCompleted = attendance.daysPresent; // Simplified: 1 shift per day

    // Base pay = shiftRate * shiftsCompleted
    const basePay = shiftRate * shiftsCompleted;

    // Overtime pay
    const overtimePay = (attendance.overtimeMinutes / 60) * hourlyRate * overtimeRate;

    return {
      gross: Math.round((basePay + overtimePay) * 100) / 100,
      absenceDeductions: 0,
      daysPresent: attendance.daysPresent,
      daysAbsent: attendance.daysAbsent,
      regularMinutes: 0,
      overtimeMinutes: attendance.overtimeMinutes,
      metadata: {
        salaryType: 'PER_SHIFT',
        shiftRate,
        hourlyRate,
        overtimeRate,
        shiftsCompleted,
        basePay,
        overtimePay,
      },
    };
  }

  /**
   * Apply pay components (earnings) to gross
   */
  async applyEarnings(orgId: string, _userId: string, gross: number): Promise<number> {
    const components = await this.prisma.client.payComponent.findMany({
      where: { orgId, active: true, type: 'EARNING' },
    });

    let additionalEarnings = 0;
    for (const component of components) {
      const value = Number(component.value);
      switch (component.calc) {
        case 'FIXED':
          additionalEarnings += value;
          break;
        case 'PERCENT':
          additionalEarnings += (gross * value) / 100;
          break;
        case 'RATE':
          // For RATE, could be based on hours or other factors (skip for now)
          break;
      }
    }

    return Math.round((gross + additionalEarnings) * 100) / 100;
  }

  /**
   * Calculate deductions (tax + deduction components)
   */
  async calculateDeductions(
    orgId: string,
    _userId: string,
    gross: number,
  ): Promise<{ tax: number; deductions: number }> {
    // Get tax rate from org settings
    const settings = await this.prisma.client.orgSettings.findUnique({
      where: { orgId },
      select: { metadata: true },
    });

    const metadata = (settings?.metadata as any) || {};
    const taxPct = metadata.payrollTaxPct || 0;

    const tax = Math.round(((gross * taxPct) / 100) * 100) / 100;

    // Apply deduction components
    const components = await this.prisma.client.payComponent.findMany({
      where: { orgId, active: true, type: 'DEDUCTION' },
    });

    let deductions = 0;
    for (const component of components) {
      const value = Number(component.value);
      if (component.calc === 'FIXED') {
        deductions += value;
      } else if (component.calc === 'PERCENT') {
        deductions += (gross * value) / 100;
      }
    }

    return { tax: Math.round(tax * 100) / 100, deductions: Math.round(deductions * 100) / 100 };
  }
}
