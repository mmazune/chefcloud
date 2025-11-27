/**
 * M24-S1: Employee Management Controller
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { CurrentUser } from '../auth/current-user.decorator';
import { EmployeesService } from './employees.service';
import { CreateEmployeeDto, UpdateEmployeeDto, EmployeeListQueryDto } from './employees.dto';

@Controller('hr/employees')
@UseGuards(JwtAuthGuard)
export class EmployeesController {
  constructor(private readonly employeesService: EmployeesService) {}

  /**
   * GET /hr/employees
   * List employees with pagination and filters
   */
  @Get()
  async listEmployees(@Query() query: EmployeeListQueryDto, @CurrentUser() user: any) {
    return this.employeesService.listEmployees(query, user.orgId);
  }

  /**
   * GET /hr/employees/:id
   * Get a single employee by ID
   */
  @Get(':id')
  async getEmployee(@Param('id') id: string, @CurrentUser() user: any) {
    return this.employeesService.getEmployee(id, user.orgId);
  }

  /**
   * POST /hr/employees
   * Create a new employee (L4+)
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEmployee(@Body() dto: CreateEmployeeDto, @CurrentUser() user: any) {
    // TODO: Add RBAC check for L4+
    return this.employeesService.createEmployee(dto, user.orgId, user.id);
  }

  /**
   * PATCH /hr/employees/:id
   * Update an employee (L4+)
   */
  @Patch(':id')
  async updateEmployee(
    @Param('id') id: string,
    @Body() dto: UpdateEmployeeDto,
    @CurrentUser() user: any,
  ) {
    // TODO: Add RBAC check for L4+
    return this.employeesService.updateEmployee(id, dto, user.orgId);
  }
}
