/**
 * M24-S1: Employee Management Service
 */

import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeListQueryDto } from './employees.dto';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * List employees with pagination and filters
   */
  async listEmployees(query: EmployeeListQueryDto, orgId: string) {
    const page = query.page || 1;
    const pageSize = query.pageSize || 20;
    const skip = (page - 1) * pageSize;

    const where: any = {
      orgId,
    };

    if (query.branchId) {
      where.branchId = query.branchId;
    }

    if (query.isActive !== undefined) {
      where.status = query.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    if (query.search) {
      where.OR = [
        { firstName: { contains: query.search, mode: 'insensitive' } },
        { lastName: { contains: query.search, mode: 'insensitive' } },
        { employeeCode: { contains: query.search, mode: 'insensitive' } },
      ];

      // If search looks like email, add email search if user relation exists
      if (query.search.includes('@')) {
        where.OR.push({
          user: {
            email: { contains: query.search, mode: 'insensitive' },
          },
        });
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.employee.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: {
            select: {
              email: true,
              roleLevel: true,
            },
          },
          contracts: {
            where: {
              endDate: null, // Active contract
            },
            orderBy: {
              startDate: 'desc',
            },
            take: 1,
            select: {
              salaryType: true,
              salaryAmount: true,
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
      }),
      this.prisma.employee.count({ where }),
    ]);

    const formattedItems = items.map((emp) => {
      const contract = emp.contracts[0];
      return {
        id: emp.id,
        employeeCode: emp.employeeCode,
        firstName: emp.firstName,
        lastName: emp.lastName,
        email: emp.user?.email || null,
        position: emp.position,
        branchId: emp.branchId,
        roleLevel: emp.user?.roleLevel || null,
        salaryType: contract?.salaryType || null,
        baseSalaryAmount: contract?.salaryAmount ? Number(contract.salaryAmount) : null,
        isActive: emp.status === 'ACTIVE',
        hiredAt: emp.hiredAt.toISOString(),
        createdAt: emp.createdAt.toISOString(),
      };
    });

    return {
      items: formattedItems,
      page,
      pageSize,
      total,
    };
  }

  /**
   * Get a single employee by ID
   */
  async getEmployee(id: string, orgId: string) {
    const employee = await this.prisma.employee.findFirst({
      where: {
        id,
        orgId,
      },
      include: {
        user: {
          select: {
            email: true,
            phone: true,
            roleLevel: true,
          },
        },
        contracts: {
          where: {
            endDate: null,
          },
          orderBy: {
            startDate: 'desc',
          },
          take: 1,
        },
        attendanceRecords: {
          take: 10,
          orderBy: {
            date: 'desc',
          },
          select: {
            date: true,
            status: true,
          },
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const contract = employee.contracts[0];

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.user?.email || null,
      phone: employee.user?.phone || null,
      position: employee.position,
      branchId: employee.branchId,
      roleLevel: employee.user?.roleLevel || null,
      salaryType: contract?.salaryType || null,
      baseSalaryAmount: contract?.salaryAmount ? Number(contract.salaryAmount) : null,
      isActive: employee.status === 'ACTIVE',
      hiredAt: employee.hiredAt.toISOString(),
      terminatedAt: employee.terminatedAt?.toISOString() || null,
      createdAt: employee.createdAt.toISOString(),
      recentAttendance: employee.attendanceRecords.map((a) => ({
        date: a.date.toISOString(),
        status: a.status,
      })),
    };
  }

  /**
   * Create a new employee
   */
  async createEmployee(dto: CreateEmployeeDto, orgId: string, createdById: string): Promise<any> {
    // Generate unique employee code
    const employeeCode = await this.generateEmployeeCode(orgId);

    // Create user if email is provided
    let userId: string | null = null;
    if (dto.email) {
      const existingUser = await this.prisma.user.findUnique({
        where: { email: dto.email },
      });

      if (existingUser) {
        // Link to existing user
        userId = existingUser.id;
      } else {
        // Create new user
        const newUser = await this.prisma.user.create({
          data: {
            email: dto.email,
            phone: dto.phone,
            firstName: dto.firstName,
            lastName: dto.lastName,
            orgId,
            branchId: dto.branchId,
            roleLevel: 'L1', // Default to L1, can be changed later
            password: '', // Temporary, user must reset
          },
        });
        userId = newUser.id;
      }
    }

    // Create employee
    const employee = await this.prisma.employee.create({
      data: {
        orgId,
        branchId: dto.branchId,
        userId,
        employeeCode,
        firstName: dto.firstName,
        lastName: dto.lastName,
        position: dto.position || null,
        status: dto.isActive === false ? 'INACTIVE' : 'ACTIVE',
        hiredAt: new Date(),
      },
      include: {
        user: {
          select: {
            email: true,
            roleLevel: true,
          },
        },
      },
    });

    // Create employment contract if salary info provided
    if (dto.salaryType && dto.baseSalaryAmount) {
      await this.prisma.employmentContract.create({
        data: {
          employeeId: employee.id,
          orgId,
          salaryType: dto.salaryType,
          salaryAmount: dto.baseSalaryAmount,
          startDate: new Date(),
          endDate: null,
        },
      });
    }

    return {
      id: employee.id,
      employeeCode: employee.employeeCode,
      firstName: employee.firstName,
      lastName: employee.lastName,
      email: employee.user?.email || null,
      branchId: employee.branchId,
      isActive: employee.status === 'ACTIVE',
    };
  }

  /**
   * Update an employee
   */
  async updateEmployee(id: string, dto: UpdateEmployeeDto, orgId: string): Promise<any> {
    const employee = await this.prisma.employee.findFirst({
      where: { id, orgId },
      include: {
        user: true,
        contracts: {
          where: { endDate: null },
          take: 1,
        },
      },
    });

    if (!employee) {
      throw new NotFoundException(`Employee ${id} not found`);
    }

    const updateData: any = {};

    if (dto.firstName) updateData.firstName = dto.firstName;
    if (dto.lastName) updateData.lastName = dto.lastName;
    if (dto.position !== undefined) updateData.position = dto.position;
    if (dto.branchId) updateData.branchId = dto.branchId;
    if (dto.isActive !== undefined) {
      updateData.status = dto.isActive ? 'ACTIVE' : 'INACTIVE';
    }

    // Update employee
    const updated = await this.prisma.employee.update({
      where: { id },
      data: updateData,
      include: {
        user: {
          select: {
            email: true,
            roleLevel: true,
          },
        },
      },
    });

    // Update user if needed
    if (employee.userId && (dto.email || dto.phone)) {
      await this.prisma.user.update({
        where: { id: employee.userId },
        data: {
          ...(dto.email && { email: dto.email }),
          ...(dto.phone && { phone: dto.phone }),
        },
      });
    }

    // Update contract if salary info changed
    if ((dto.salaryType || dto.baseSalaryAmount) && employee.contracts[0]) {
      await this.prisma.employmentContract.update({
        where: { id: employee.contracts[0].id },
        data: {
          ...(dto.salaryType && { salaryType: dto.salaryType }),
          ...(dto.baseSalaryAmount && { salaryAmount: dto.baseSalaryAmount }),
        },
      });
    } else if (dto.salaryType && dto.baseSalaryAmount && !employee.contracts[0]) {
      // Create new contract if none exists
      await this.prisma.employmentContract.create({
        data: {
          employeeId: employee.id,
          orgId,
          salaryType: dto.salaryType,
          salaryAmount: dto.baseSalaryAmount,
          startDate: new Date(),
          endDate: null,
        },
      });
    }

    return {
      id: updated.id,
      employeeCode: updated.employeeCode,
      firstName: updated.firstName,
      lastName: updated.lastName,
      email: updated.user?.email || null,
      branchId: updated.branchId,
      isActive: updated.status === 'ACTIVE',
    };
  }

  /**
   * Generate unique employee code
   */
  private async generateEmployeeCode(orgId: string): Promise<string> {
    const count = await this.prisma.employee.count({ where: { orgId } });
    const code = `EMP${String(count + 1).padStart(5, '0')}`;

    // Check if exists (unlikely but possible)
    const existing = await this.prisma.employee.findUnique({
      where: { employeeCode: code },
    });

    if (existing) {
      // Fallback: use timestamp
      return `EMP${Date.now()}`;
    }

    return code;
  }
}
