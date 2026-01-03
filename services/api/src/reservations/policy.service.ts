/**
 * M9.2: Reservation Policy Service
 * 
 * Manages per-branch reservation policies:
 * - Lead times, party sizes, hold expiration
 * - Deposit rules
 * - No-show fee configuration
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { UpsertPolicyDto } from './reservations.dto';

@Injectable()
export class PolicyService {
  private readonly logger = new Logger(PolicyService.name);

  constructor(private prisma: PrismaService) {}

  /**
   * Get policy for a branch
   */
  async getPolicy(orgId: string, branchId: string): Promise<unknown> {
    const policy = await this.prisma.client.reservationPolicy.findUnique({
      where: { branchId },
    });

    if (!policy) {
      throw new NotFoundException(`No policy found for branch ${branchId}`);
    }

    if (policy.orgId !== orgId) {
      throw new NotFoundException(`No policy found for branch ${branchId}`);
    }

    return policy;
  }

  /**
   * Get policy for a branch or return defaults
   */
  async getPolicyOrDefaults(orgId: string, branchId: string): Promise<{
    leadTimeMinutes: number;
    maxPartySize: number;
    holdExpiresMinutes: number;
    cancelCutoffMinutes: number;
    depositRequired: boolean;
    depositAmountDefault: number;
    depositPerGuest: number;
    noShowFeeEnabled: boolean;
    noShowFeeAmount: number;
  }> {
    try {
      const policy = await this.getPolicy(orgId, branchId);
      return {
        leadTimeMinutes: (policy as { leadTimeMinutes: number }).leadTimeMinutes,
        maxPartySize: (policy as { maxPartySize: number }).maxPartySize,
        holdExpiresMinutes: (policy as { holdExpiresMinutes: number }).holdExpiresMinutes,
        cancelCutoffMinutes: (policy as { cancelCutoffMinutes: number }).cancelCutoffMinutes,
        depositRequired: (policy as { depositRequired: boolean }).depositRequired,
        depositAmountDefault: Number((policy as { depositAmountDefault: number }).depositAmountDefault),
        depositPerGuest: Number((policy as { depositPerGuest: number }).depositPerGuest),
        noShowFeeEnabled: (policy as { noShowFeeEnabled: boolean }).noShowFeeEnabled,
        noShowFeeAmount: Number((policy as { noShowFeeAmount: number }).noShowFeeAmount),
      };
    } catch {
      // Return defaults
      return {
        leadTimeMinutes: 60,
        maxPartySize: 20,
        holdExpiresMinutes: 30,
        cancelCutoffMinutes: 120,
        depositRequired: false,
        depositAmountDefault: 0,
        depositPerGuest: 0,
        noShowFeeEnabled: false,
        noShowFeeAmount: 0,
      };
    }
  }

  /**
   * Upsert policy for a branch
   */
  async upsertPolicy(
    orgId: string,
    branchId: string,
    dto: UpsertPolicyDto,
  ): Promise<unknown> {
    // Verify branch belongs to org
    const branch = await this.prisma.client.branch.findUnique({
      where: { id: branchId },
    });

    if (!branch || branch.orgId !== orgId) {
      throw new NotFoundException(`Branch ${branchId} not found`);
    }

    const existing = await this.prisma.client.reservationPolicy.findUnique({
      where: { branchId },
    });

    if (existing) {
      // Update
      const updated = await this.prisma.client.reservationPolicy.update({
        where: { branchId },
        data: {
          leadTimeMinutes: dto.leadTimeMinutes,
          maxPartySize: dto.maxPartySize,
          holdExpiresMinutes: dto.holdExpiresMinutes,
          cancelCutoffMinutes: dto.cancelCutoffMinutes,
          depositRequired: dto.depositRequired,
          depositAmountDefault: dto.depositAmountDefault,
          depositPerGuest: dto.depositPerGuest,
          noShowFeeEnabled: dto.noShowFeeEnabled,
          noShowFeeAmount: dto.noShowFeeAmount,
          // M9.3 fields
          autoExpireHeldEnabled: dto.autoExpireHeldEnabled,
          waitlistAutoPromote: dto.waitlistAutoPromote,
          reminderEnabled: dto.reminderEnabled,
          reminderLeadMinutes: dto.reminderLeadMinutes,
          maxCapacityPerSlot: dto.maxCapacityPerSlot,
          noShowGraceMinutes: dto.noShowGraceMinutes,
        },
      });

      this.logger.log(`Updated policy for branch ${branchId}`);
      return updated;
    } else {
      // Create
      const created = await this.prisma.client.reservationPolicy.create({
        data: {
          orgId,
          branchId,
          leadTimeMinutes: dto.leadTimeMinutes ?? 60,
          maxPartySize: dto.maxPartySize ?? 20,
          holdExpiresMinutes: dto.holdExpiresMinutes ?? 30,
          cancelCutoffMinutes: dto.cancelCutoffMinutes ?? 120,
          depositRequired: dto.depositRequired ?? false,
          depositAmountDefault: dto.depositAmountDefault ?? 0,
          depositPerGuest: dto.depositPerGuest ?? 0,
          noShowFeeEnabled: dto.noShowFeeEnabled ?? false,
          noShowFeeAmount: dto.noShowFeeAmount ?? 0,
          // M9.3 fields
          autoExpireHeldEnabled: dto.autoExpireHeldEnabled ?? true,
          waitlistAutoPromote: dto.waitlistAutoPromote ?? false,
          reminderEnabled: dto.reminderEnabled ?? true,
          reminderLeadMinutes: dto.reminderLeadMinutes ?? 1440,
          maxCapacityPerSlot: dto.maxCapacityPerSlot ?? null,
          noShowGraceMinutes: dto.noShowGraceMinutes ?? 15,
        },
      });

      this.logger.log(`Created policy for branch ${branchId}`);
      return created;
    }
  }

  /**
   * Calculate deposit amount based on policy
   */
  calculateDepositAmount(
    policy: { depositAmountDefault: number; depositPerGuest: number },
    partySize: number,
  ): number {
    if (policy.depositPerGuest > 0) {
      return policy.depositPerGuest * partySize;
    }
    return policy.depositAmountDefault;
  }
}
