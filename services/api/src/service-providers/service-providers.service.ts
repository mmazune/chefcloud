import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import {
  CreateServiceProviderDto,
  UpdateServiceProviderDto,
  ServiceProviderResponse,
  CreateServiceContractDto,
  UpdateServiceContractDto,
  ServiceContractResponse,
} from './dto/service-provider.dto';
import { ContractFrequency } from '@chefcloud/db';

/**
 * M7: Service Providers & Contracts Management
 * 
 * Handles CRUD operations for service providers (landlords, utilities, DJs, etc.)
 * and their contracts with automated payment tracking.
 */
@Injectable()
export class ServiceProvidersService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== Service Providers =====

  async createProvider(
    orgId: string,
    dto: CreateServiceProviderDto,
  ): Promise<ServiceProviderResponse> {
    // Validate branch belongs to org if provided
    if (dto.branchId) {
      const branch = await this.prisma.client.branch.findFirst({
        where: { id: dto.branchId, orgId },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found or does not belong to organization');
      }
    }

    const provider = await this.prisma.client.serviceProvider.create({
      data: {
        orgId,
        ...dto,
      },
    });

    return this.mapProviderResponse(provider);
  }

  async getProviders(
    orgId: string,
    branchId?: string,
    category?: string,
    isActive?: boolean,
  ): Promise<ServiceProviderResponse[]> {
    const providers = await this.prisma.client.serviceProvider.findMany({
      where: {
        orgId,
        ...(branchId && { branchId }),
        ...(category && { category: category as any }),
        ...(isActive !== undefined && { isActive }),
      },
      include: {
        _count: {
          select: { contracts: true },
        },
      },
      orderBy: [{ category: 'asc' }, { name: 'asc' }],
    });

    return providers.map((p) => ({
      ...this.mapProviderResponse(p),
      contractCount: p._count.contracts,
    }));
  }

  async getProvider(orgId: string, providerId: string): Promise<ServiceProviderResponse> {
    const provider = await this.prisma.client.serviceProvider.findFirst({
      where: { id: providerId, orgId },
      include: {
        _count: {
          select: { contracts: true },
        },
      },
    });

    if (!provider) {
      throw new NotFoundException('Service provider not found');
    }

    return {
      ...this.mapProviderResponse(provider),
      contractCount: provider._count.contracts,
    };
  }

  async updateProvider(
    orgId: string,
    providerId: string,
    dto: UpdateServiceProviderDto,
  ): Promise<ServiceProviderResponse> {
    // Verify provider exists and belongs to org
    await this.getProvider(orgId, providerId);

    const provider = await this.prisma.client.serviceProvider.update({
      where: { id: providerId },
      data: dto,
    });

    return this.mapProviderResponse(provider);
  }

  async deleteProvider(orgId: string, providerId: string): Promise<void> {
    // Verify provider exists and belongs to org
    await this.getProvider(orgId, providerId);

    // Check for active contracts
    const activeContractsCount = await this.prisma.client.serviceContract.count({
      where: {
        providerId,
        status: 'ACTIVE',
      },
    });

    if (activeContractsCount > 0) {
      throw new BadRequestException(
        `Cannot delete provider with ${activeContractsCount} active contract(s). ` +
        'Please cancel or complete all contracts first.'
      );
    }

    await this.prisma.client.serviceProvider.delete({
      where: { id: providerId },
    });
  }

  // ===== Service Contracts =====

  async createContract(
    orgId: string,
    dto: CreateServiceContractDto,
  ): Promise<ServiceContractResponse> {
    // Verify provider exists and belongs to org
    await this.getProvider(orgId, dto.providerId);

    // Validate branch if provided
    if (dto.branchId) {
      const branch = await this.prisma.client.branch.findFirst({
        where: { id: dto.branchId, orgId },
      });
      if (!branch) {
        throw new BadRequestException('Branch not found or does not belong to organization');
      }
    }

    // Validate dueDay based on frequency
    this.validateDueDay(dto.frequency, dto.dueDay);

    // Validate date range
    const startDate = new Date(dto.startDate);
    const endDate = dto.endDate ? new Date(dto.endDate) : null;

    if (endDate && endDate <= startDate) {
      throw new BadRequestException('End date must be after start date');
    }

    const contract = await this.prisma.client.serviceContract.create({
      data: {
        providerId: dto.providerId,
        branchId: dto.branchId,
        frequency: dto.frequency,
        amount: dto.amount,
        currency: dto.currency || 'UGX',
        taxRate: dto.taxRate,
        dueDay: dto.dueDay,
        startDate,
        endDate,
        glAccount: dto.glAccount,
        costCenter: dto.costCenter,
        notes: dto.notes,
        status: 'ACTIVE',
      },
      include: {
        provider: {
          select: { name: true },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    return this.mapContractResponse(contract);
  }

  async getContracts(
    orgId: string,
    branchId?: string,
    providerId?: string,
    status?: string,
  ): Promise<ServiceContractResponse[]> {
    const contracts = await this.prisma.client.serviceContract.findMany({
      where: {
        provider: { orgId },
        ...(branchId && { branchId }),
        ...(providerId && { providerId }),
        ...(status && { status: status as any }),
      },
      include: {
        provider: {
          select: { name: true },
        },
        branch: {
          select: { name: true },
        },
      },
      orderBy: [{ startDate: 'desc' }],
    });

    return contracts.map(this.mapContractResponse);
  }

  async getContract(orgId: string, contractId: string): Promise<ServiceContractResponse> {
    const contract = await this.prisma.client.serviceContract.findFirst({
      where: {
        id: contractId,
        provider: { orgId },
      },
      include: {
        provider: {
          select: { name: true },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Service contract not found');
    }

    return this.mapContractResponse(contract);
  }

  async updateContract(
    orgId: string,
    contractId: string,
    dto: UpdateServiceContractDto,
  ): Promise<ServiceContractResponse> {
    // Verify contract exists
    const existing = await this.getContract(orgId, contractId);

    // Validate dueDay if being updated
    if (dto.dueDay !== undefined) {
      this.validateDueDay(existing.frequency, dto.dueDay);
    }

    // Validate end date if being updated
    if (dto.endDate) {
      const endDate = new Date(dto.endDate);
      if (endDate <= existing.startDate) {
        throw new BadRequestException('End date must be after start date');
      }
    }

    const contract = await this.prisma.client.serviceContract.update({
      where: { id: contractId },
      data: {
        ...(dto.amount !== undefined && { amount: dto.amount }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.dueDay !== undefined && { dueDay: dto.dueDay }),
        ...(dto.endDate && { endDate: new Date(dto.endDate) }),
        ...(dto.status && { status: dto.status }),
        ...(dto.glAccount !== undefined && { glAccount: dto.glAccount }),
        ...(dto.costCenter !== undefined && { costCenter: dto.costCenter }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      include: {
        provider: {
          select: { name: true },
        },
        branch: {
          select: { name: true },
        },
      },
    });

    return this.mapContractResponse(contract);
  }

  async deleteContract(orgId: string, contractId: string): Promise<void> {
    // Verify contract exists
    await this.getContract(orgId, contractId);

    // Check for pending reminders
    const pendingRemindersCount = await this.prisma.client.servicePayableReminder.count({
      where: {
        contractId,
        status: { in: ['PENDING', 'SENT'] },
      },
    });

    if (pendingRemindersCount > 0) {
      throw new BadRequestException(
        `Cannot delete contract with ${pendingRemindersCount} pending reminder(s). ` +
        'Please resolve all reminders first.'
      );
    }

    await this.prisma.client.serviceContract.delete({
      where: { id: contractId },
    });
  }

  // ===== Helper Methods =====

  private validateDueDay(frequency: ContractFrequency, dueDay?: number | null): void {
    if (dueDay === undefined || dueDay === null) {
      return; // Optional field
    }

    if (frequency === ContractFrequency.MONTHLY) {
      if (dueDay < 1 || dueDay > 31) {
        throw new BadRequestException('For MONTHLY frequency, dueDay must be between 1-31');
      }
    } else if (frequency === ContractFrequency.WEEKLY) {
      if (dueDay < 0 || dueDay > 6) {
        throw new BadRequestException(
          'For WEEKLY frequency, dueDay must be between 0-6 (0=Sunday, 6=Saturday)'
        );
      }
    } else if (frequency === ContractFrequency.ONE_OFF) {
      // ONE_OFF doesn't use dueDay
      if (dueDay !== null) {
        throw new BadRequestException('ONE_OFF contracts should not specify dueDay');
      }
    }
    // DAILY doesn't use dueDay
  }

  private mapProviderResponse(provider: any): ServiceProviderResponse {
    return {
      id: provider.id,
      orgId: provider.orgId,
      branchId: provider.branchId,
      name: provider.name,
      category: provider.category,
      contactName: provider.contactName,
      contactEmail: provider.contactEmail,
      contactPhone: provider.contactPhone,
      isActive: provider.isActive,
      notes: provider.notes,
      createdAt: provider.createdAt,
      updatedAt: provider.updatedAt,
    };
  }

  private mapContractResponse(contract: any): ServiceContractResponse {
    return {
      id: contract.id,
      providerId: contract.providerId,
      providerName: contract.provider?.name,
      branchId: contract.branchId,
      branchName: contract.branch?.name,
      frequency: contract.frequency,
      amount: Number(contract.amount),
      currency: contract.currency,
      taxRate: contract.taxRate ? Number(contract.taxRate) : null,
      dueDay: contract.dueDay,
      startDate: contract.startDate,
      endDate: contract.endDate,
      status: contract.status,
      glAccount: contract.glAccount,
      costCenter: contract.costCenter,
      notes: contract.notes,
      createdAt: contract.createdAt,
      updatedAt: contract.updatedAt,
    };
  }
}
