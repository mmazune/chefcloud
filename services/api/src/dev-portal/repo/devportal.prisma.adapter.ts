import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { DevPortalKeyRepo, DeveloperApiKeyRecord } from '../ports/devportal.port';

/**
 * Prisma adapter for DevPortal key repository
 * Uses `as any` cast to access developerApiKey model not yet in Prisma schema
 */
@Injectable()
export class DevPortalPrismaRepo implements DevPortalKeyRepo {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Type-safe accessor to developerApiKey table
   * Uses any cast since model not in generated Prisma types yet
   */
  private get repo() {
    return (this.prisma as any).developerApiKey;
  }

  async findMany(): Promise<DeveloperApiKeyRecord[]> {
    return this.repo.findMany({});
  }

  async create(data: { label: string; plan: 'free' | 'pro' }): Promise<DeveloperApiKeyRecord> {
    return this.repo.create({ data });
  }

  async update({ id, ...data }: { id: string; active?: boolean; plan?: 'free' | 'pro'; label?: string }): Promise<DeveloperApiKeyRecord> {
    return this.repo.update({ where: { id }, data });
  }
}
