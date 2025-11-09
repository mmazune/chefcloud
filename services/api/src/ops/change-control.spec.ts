import { Test, TestingModule } from '@nestjs/testing';
import { FeatureFlagsService } from './feature-flags.service';
import { MaintenanceService } from './maintenance.service';
import { PrismaService } from '../prisma.service';
import { NotFoundException } from '@nestjs/common';

describe('E49-s1: Change Control & Staged Rollouts', () => {
  let flagsService: FeatureFlagsService;
  let maintenanceService: MaintenanceService;
  let mockPrismaClient: any;

  beforeEach(async () => {
    mockPrismaClient = {
      featureFlag: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        upsert: jest.fn(),
        findMany: jest.fn(),
      },
      flagAudit: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
      maintenanceWindow: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        MaintenanceService,
        {
          provide: PrismaService,
          useValue: { client: mockPrismaClient },
        },
      ],
    }).compile();

    flagsService = module.get<FeatureFlagsService>(FeatureFlagsService);
    maintenanceService = module.get<MaintenanceService>(MaintenanceService);
  });

  describe('FeatureFlagsService', () => {
    describe('Rollout Percentage Determinism', () => {
      it('should enable flag for 100% rollout', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'TEST_FLAG',
          active: true,
          rolloutPct: 100,
          scopes: null,
        });

        const result = await flagsService.get('TEST_FLAG', { orgId: 'org-1' });
        expect(result).toBe(true);
      });

      it('should disable flag for 0% rollout', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'TEST_FLAG',
          active: true,
          rolloutPct: 0,
          scopes: null,
        });

        const result = await flagsService.get('TEST_FLAG', { orgId: 'org-1' });
        expect(result).toBe(false);
      });

      it('should use deterministic hash for percentage rollout', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'TEST_FLAG',
          active: true,
          rolloutPct: 50,
          scopes: null,
        });

        // Same context should always return same result
        const result1 = await flagsService.get('TEST_FLAG', {
          orgId: 'org-1',
          branchId: 'branch-1',
        });
        const result2 = await flagsService.get('TEST_FLAG', {
          orgId: 'org-1',
          branchId: 'branch-1',
        });
        expect(result1).toBe(result2);
      });

      it('should distribute 50% rollout across different contexts', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'TEST_FLAG',
          active: true,
          rolloutPct: 50,
          scopes: null,
        });

        // Test multiple contexts - should see mix of true/false
        const results = await Promise.all([
          flagsService.get('TEST_FLAG', { orgId: 'org-1' }),
          flagsService.get('TEST_FLAG', { orgId: 'org-2' }),
          flagsService.get('TEST_FLAG', { orgId: 'org-3' }),
          flagsService.get('TEST_FLAG', { orgId: 'org-4' }),
          flagsService.get('TEST_FLAG', { orgId: 'org-5' }),
        ]);

        const enabledCount = results.filter((r) => r).length;
        // With 5 orgs and 50% rollout, expect some variation (not all true or all false)
        expect(enabledCount).toBeGreaterThan(0);
        expect(enabledCount).toBeLessThan(5);
      });
    });

    describe('Scope Matching', () => {
      it('should match role scope', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'ADMIN_FEATURE',
          active: true,
          rolloutPct: 100,
          scopes: { roles: ['L5', 'L4'] },
        });

        const allowed = await flagsService.get('ADMIN_FEATURE', { role: 'L5' });
        expect(allowed).toBe(true);

        const denied = await flagsService.get('ADMIN_FEATURE', { role: 'L2' });
        expect(denied).toBe(false);
      });

      it('should match branch scope', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'BRANCH_FEATURE',
          active: true,
          rolloutPct: 100,
          scopes: { branches: ['branch-1', 'branch-2'] },
        });

        const allowed = await flagsService.get('BRANCH_FEATURE', { branchId: 'branch-1' });
        expect(allowed).toBe(true);

        const denied = await flagsService.get('BRANCH_FEATURE', { branchId: 'branch-3' });
        expect(denied).toBe(false);
      });

      it('should require ALL scopes to match', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'SCOPED_FEATURE',
          active: true,
          rolloutPct: 100,
          scopes: { roles: ['L4'], branches: ['branch-1'] },
        });

        const allowed = await flagsService.get('SCOPED_FEATURE', {
          role: 'L4',
          branchId: 'branch-1',
        });
        expect(allowed).toBe(true);

        const deniedRole = await flagsService.get('SCOPED_FEATURE', {
          role: 'L2',
          branchId: 'branch-1',
        });
        expect(deniedRole).toBe(false);

        const deniedBranch = await flagsService.get('SCOPED_FEATURE', {
          role: 'L4',
          branchId: 'branch-2',
        });
        expect(deniedBranch).toBe(false);
      });
    });

    describe('Kill Switch', () => {
      it('should set active=false and rolloutPct=0', async () => {
        const flag = {
          key: 'DANGEROUS_FLAG',
          active: true,
          rolloutPct: 100,
        };

        mockPrismaClient.featureFlag.findUnique.mockResolvedValue(flag);
        mockPrismaClient.featureFlag.update.mockResolvedValue({
          ...flag,
          active: false,
          rolloutPct: 0,
        });

        await flagsService.kill('DANGEROUS_FLAG', 'user-admin');

        expect(mockPrismaClient.featureFlag.update).toHaveBeenCalledWith({
          where: { key: 'DANGEROUS_FLAG' },
          data: {
            active: false,
            rolloutPct: 0,
            updatedById: 'user-admin',
          },
        });
      });

      it('should create audit trail on kill', async () => {
        const flag = {
          key: 'TEST_FLAG',
          active: true,
          rolloutPct: 50,
        };

        mockPrismaClient.featureFlag.findUnique.mockResolvedValue(flag);
        mockPrismaClient.featureFlag.update.mockResolvedValue({ ...flag, active: false });

        await flagsService.kill('TEST_FLAG', 'user-admin');

        expect(mockPrismaClient.flagAudit.create).toHaveBeenCalledWith({
          data: {
            flagKey: 'TEST_FLAG',
            userId: 'user-admin',
            action: 'KILL',
            before: flag,
            after: { active: false, rolloutPct: 0 },
          },
        });
      });

      it('should throw NotFoundException if flag does not exist', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue(null);

        await expect(flagsService.kill('NONEXISTENT', 'user-admin')).rejects.toThrow(
          NotFoundException,
        );
      });
    });

    describe('Flag Upsert', () => {
      it('should create new flag with CREATE audit', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue(null);
        mockPrismaClient.featureFlag.upsert.mockResolvedValue({
          key: 'NEW_FLAG',
          active: true,
          rolloutPct: 25,
        });

        await flagsService.upsert('NEW_FLAG', { active: true, rolloutPct: 25 }, 'user-admin');

        expect(mockPrismaClient.flagAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'CREATE',
            before: undefined,
          }),
        });
      });

      it('should update existing flag with UPDATE audit', async () => {
        const existing = { key: 'EXISTING_FLAG', active: false, rolloutPct: 0 };
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue(existing);
        mockPrismaClient.featureFlag.upsert.mockResolvedValue({
          ...existing,
          active: true,
          rolloutPct: 50,
        });

        await flagsService.upsert('EXISTING_FLAG', { active: true, rolloutPct: 50 }, 'user-admin');

        expect(mockPrismaClient.flagAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'UPDATE',
            before: existing,
          }),
        });
      });
    });

    describe('Flag Toggle', () => {
      it('should toggle active state', async () => {
        mockPrismaClient.featureFlag.findUnique.mockResolvedValue({
          key: 'TOGGLE_FLAG',
          active: true,
        });
        mockPrismaClient.featureFlag.update.mockResolvedValue({
          key: 'TOGGLE_FLAG',
          active: false,
        });

        await flagsService.toggle('TOGGLE_FLAG', 'user-admin');

        expect(mockPrismaClient.featureFlag.update).toHaveBeenCalledWith({
          where: { key: 'TOGGLE_FLAG' },
          data: {
            active: false,
            updatedById: 'user-admin',
          },
        });

        expect(mockPrismaClient.flagAudit.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            action: 'TOGGLE',
          }),
        });
      });
    });
  });

  describe('MaintenanceService', () => {
    describe('Write Blocking', () => {
      it('should block writes during active maintenance window', async () => {
        const now = new Date('2025-10-29T12:00:00Z');
        mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue({
          id: 'mw-1',
          startsAt: new Date('2025-10-29T11:00:00Z'),
          endsAt: new Date('2025-10-29T13:00:00Z'),
          blockWrites: true,
          message: 'Scheduled maintenance',
        });

        const result = await maintenanceService.isBlockedWrite(now);

        expect(result.blocked).toBe(true);
        expect(result.message).toBe('Scheduled maintenance');
      });

      it('should allow writes outside maintenance window', async () => {
        const now = new Date('2025-10-29T14:00:00Z');
        mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue(null);

        const result = await maintenanceService.isBlockedWrite(now);

        expect(result.blocked).toBe(false);
      });

      it('should return default message if none provided', async () => {
        const now = new Date('2025-10-29T12:00:00Z');
        mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue({
          id: 'mw-1',
          startsAt: new Date('2025-10-29T11:00:00Z'),
          endsAt: new Date('2025-10-29T13:00:00Z'),
          blockWrites: true,
          message: null,
        });

        const result = await maintenanceService.isBlockedWrite(now);

        expect(result.blocked).toBe(true);
        expect(result.message).toBe('System is under maintenance. Please try again later.');
      });

      it('should scope maintenance to org', async () => {
        const now = new Date('2025-10-29T12:00:00Z');
        mockPrismaClient.maintenanceWindow.findFirst.mockResolvedValue(null);

        await maintenanceService.isBlockedWrite(now, 'org-1');

        expect(mockPrismaClient.maintenanceWindow.findFirst).toHaveBeenCalledWith({
          where: expect.objectContaining({
            orgId: 'org-1',
          }),
          orderBy: { startsAt: 'desc' },
        });
      });
    });

    describe('Create Maintenance Window', () => {
      it('should create maintenance window with defaults', async () => {
        const data = {
          startsAt: new Date('2025-10-30T00:00:00Z'),
          endsAt: new Date('2025-10-30T04:00:00Z'),
        };

        mockPrismaClient.maintenanceWindow.create.mockResolvedValue({ id: 'mw-1', ...data });

        await maintenanceService.create(data);

        expect(mockPrismaClient.maintenanceWindow.create).toHaveBeenCalledWith({
          data: expect.objectContaining({
            blockWrites: true,
          }),
        });
      });
    });

    describe('Get Active Windows', () => {
      it('should return active maintenance windows', async () => {
        const activeWindows = [
          {
            id: 'mw-1',
            startsAt: new Date('2025-10-29T11:00:00Z'),
            endsAt: new Date('2025-10-29T13:00:00Z'),
          },
        ];

        mockPrismaClient.maintenanceWindow.findMany.mockResolvedValue(activeWindows);

        const result = await maintenanceService.getActive();

        expect(result).toEqual(activeWindows);
      });
    });
  });
});
