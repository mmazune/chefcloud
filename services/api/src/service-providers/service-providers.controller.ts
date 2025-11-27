import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { ServiceProvidersService } from './service-providers.service';
import {
  CreateServiceProviderDto,
  UpdateServiceProviderDto,
  CreateServiceContractDto,
  UpdateServiceContractDto,
} from './dto/service-provider.dto';

/**
 * M7: Service Providers & Contracts API
 * 
 * RBAC:
 * - L4+ (Manager, Accountant, Owner): Full CRUD access
 * - L3 (Procurement, Accountant): Read-only access
 */
@ApiTags('Service Providers')
@ApiBearerAuth()
@Controller('service-providers')
@UseGuards(AuthGuard('jwt'), RolesGuard)
export class ServiceProvidersController {
  constructor(private readonly service: ServiceProvidersService) {}

  // ===== Service Providers =====

  @Post()
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Create service provider (L4+)' })
  async createProvider(
    @Request() req: any,
    @Body() dto: CreateServiceProviderDto,
  ) {
    return this.service.createProvider(req.user.orgId, dto);
  }

  @Get()
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'List service providers (L3+)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  async getProviders(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveBool = isActive !== undefined ? isActive === 'true' : undefined;
    return this.service.getProviders(req.user.orgId, branchId, category, isActiveBool);
  }

  @Get(':id')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'Get service provider details (L3+)' })
  async getProvider(
    @Request() req: any,
    @Param('id') providerId: string,
  ) {
    return this.service.getProvider(req.user.orgId, providerId);
  }

  @Patch(':id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Update service provider (L4+)' })
  async updateProvider(
    @Request() req: any,
    @Param('id') providerId: string,
    @Body() dto: UpdateServiceProviderDto,
  ) {
    return this.service.updateProvider(req.user.orgId, providerId, dto);
  }

  @Delete(':id')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete service provider (L4+)' })
  async deleteProvider(
    @Request() req: any,
    @Param('id') providerId: string,
  ) {
    await this.service.deleteProvider(req.user.orgId, providerId);
  }

  // ===== Service Contracts =====

  @Post('contracts')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Create service contract (L4+)' })
  async createContract(
    @Request() req: any,
    @Body() dto: CreateServiceContractDto,
  ) {
    return this.service.createContract(req.user.orgId, dto);
  }

  @Get('contracts')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'List service contracts (L3+)' })
  @ApiQuery({ name: 'branchId', required: false })
  @ApiQuery({ name: 'providerId', required: false })
  @ApiQuery({ name: 'status', required: false })
  async getContracts(
    @Request() req: any,
    @Query('branchId') branchId?: string,
    @Query('providerId') providerId?: string,
    @Query('status') status?: string,
  ) {
    return this.service.getContracts(req.user.orgId, branchId, providerId, status);
  }

  @Get('contracts/:id')
  @Roles('L3', 'L4', 'L5')
  @ApiOperation({ summary: 'Get contract details (L3+)' })
  async getContract(
    @Request() req: any,
    @Param('id') contractId: string,
  ) {
    return this.service.getContract(req.user.orgId, contractId);
  }

  @Patch('contracts/:id')
  @Roles('L4', 'L5')
  @ApiOperation({ summary: 'Update service contract (L4+)' })
  async updateContract(
    @Request() req: any,
    @Param('id') contractId: string,
    @Body() dto: UpdateServiceContractDto,
  ) {
    return this.service.updateContract(req.user.orgId, contractId, dto);
  }

  @Delete('contracts/:id')
  @Roles('L4', 'L5')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete service contract (L4+)' })
  async deleteContract(
    @Request() req: any,
    @Param('id') contractId: string,
  ) {
    await this.service.deleteContract(req.user.orgId, contractId);
  }
}
