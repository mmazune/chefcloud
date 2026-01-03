/**
 * M9.1: Waitlist Service Tests
 *
 * Tests for waitlist functionality including:
 * - CRUD operations
 * - State transitions (WAITING → SEATED, WAITING → DROPPED)
 * - Stats calculation
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { WaitlistService } from './waitlist.service';
import { PrismaService } from '../prisma.service';

describe('WaitlistService', () => {
  let service: WaitlistService;

  const mockPrismaService = {
    waitlistEntry: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WaitlistService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<WaitlistService>(WaitlistService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a waitlist entry with WAITING status', async () => {
      const orgId = 'org-1';
      const dto = {
        branchId: 'branch-1',
        name: 'John Doe',
        phone: '+256700000000',
        partySize: 4,
        notes: 'High chair needed',
        quotedWaitMinutes: 20,
      };

      const createdEntry = {
        id: 'entry-1',
        ...dto,
        orgId,
        status: 'WAITING',
        createdAt: new Date(),
      };

      mockPrismaService.waitlistEntry.create.mockResolvedValue(createdEntry);

      const result = await service.create(orgId, dto);

      expect(result.status).toBe('WAITING');
      expect(mockPrismaService.waitlistEntry.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          orgId,
          branchId: 'branch-1',
          name: 'John Doe',
          status: 'WAITING',
        }),
        include: expect.any(Object),
      });
    });
  });

  describe('seat', () => {
    it('should transition WAITING entry to SEATED', async () => {
      const orgId = 'org-1';
      const entryId = 'entry-1';

      const waitingEntry = {
        id: entryId,
        orgId,
        status: 'WAITING',
        name: 'John Doe',
      };

      mockPrismaService.waitlistEntry.findUnique.mockResolvedValue(waitingEntry);
      mockPrismaService.waitlistEntry.update.mockResolvedValue({
        ...waitingEntry,
        status: 'SEATED',
        seatedAt: new Date(),
      });

      const result = await service.seat(orgId, entryId, 'user-1');

      expect(result.status).toBe('SEATED');
      expect(result.seatedAt).toBeDefined();
      expect(mockPrismaService.waitlistEntry.update).toHaveBeenCalledWith({
        where: { id: entryId },
        data: expect.objectContaining({
          status: 'SEATED',
          seatedAt: expect.any(Date),
          seatedById: 'user-1',
        }),
        include: expect.any(Object),
      });
    });

    it('should throw ConflictException if not in WAITING status', async () => {
      const orgId = 'org-1';
      const entryId = 'entry-1';

      mockPrismaService.waitlistEntry.findUnique.mockResolvedValue({
        id: entryId,
        orgId,
        status: 'SEATED',
      });

      await expect(service.seat(orgId, entryId)).rejects.toThrow(ConflictException);
    });

    it('should throw NotFoundException if entry not found', async () => {
      const orgId = 'org-1';
      const entryId = 'entry-1';

      mockPrismaService.waitlistEntry.findUnique.mockResolvedValue(null);

      await expect(service.seat(orgId, entryId)).rejects.toThrow(NotFoundException);
    });
  });

  describe('drop', () => {
    it('should transition WAITING entry to DROPPED with reason', async () => {
      const orgId = 'org-1';
      const entryId = 'entry-1';
      const dropReason = 'Left voluntarily';

      const waitingEntry = {
        id: entryId,
        orgId,
        status: 'WAITING',
        name: 'John Doe',
      };

      mockPrismaService.waitlistEntry.findUnique.mockResolvedValue(waitingEntry);
      mockPrismaService.waitlistEntry.update.mockResolvedValue({
        ...waitingEntry,
        status: 'DROPPED',
        droppedAt: new Date(),
        droppedReason: dropReason,
      });

      const result = await service.drop(orgId, entryId, { reason: dropReason });

      expect(result.status).toBe('DROPPED');
      expect(result.droppedReason).toBe(dropReason);
    });

    it('should throw ConflictException if not in WAITING status', async () => {
      const orgId = 'org-1';
      const entryId = 'entry-1';

      mockPrismaService.waitlistEntry.findUnique.mockResolvedValue({
        id: entryId,
        orgId,
        status: 'DROPPED',
      });

      await expect(service.drop(orgId, entryId)).rejects.toThrow(ConflictException);
    });
  });

  describe('getStats', () => {
    it('should calculate waiting, seated, and dropped counts', async () => {
      const orgId = 'org-1';

      const entries = [
        { id: '1', status: 'WAITING', createdAt: new Date() },
        { id: '2', status: 'WAITING', createdAt: new Date() },
        { id: '3', status: 'SEATED', createdAt: new Date(Date.now() - 30 * 60 * 1000), seatedAt: new Date() },
        { id: '4', status: 'DROPPED', createdAt: new Date() },
      ];

      mockPrismaService.waitlistEntry.findMany.mockResolvedValue(entries);

      const result = await service.getStats(orgId);

      expect(result.waiting).toBe(2);
      expect(result.seated).toBe(1);
      expect(result.dropped).toBe(1);
      expect(result.total).toBe(4);
    });
  });

  describe('findAll', () => {
    it('should return entries filtered by status', async () => {
      const orgId = 'org-1';

      const entries = [
        { id: '1', orgId, status: 'WAITING', name: 'John' },
        { id: '2', orgId, status: 'WAITING', name: 'Jane' },
      ];

      mockPrismaService.waitlistEntry.findMany.mockResolvedValue(entries);

      const result = await service.findAll(orgId, undefined, 'WAITING');

      expect(result).toHaveLength(2);
      expect(mockPrismaService.waitlistEntry.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId,
          status: 'WAITING',
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });

    it('should filter by branchId', async () => {
      const orgId = 'org-1';
      const branchId = 'branch-1';

      mockPrismaService.waitlistEntry.findMany.mockResolvedValue([]);

      await service.findAll(orgId, branchId);

      expect(mockPrismaService.waitlistEntry.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          orgId,
          branchId,
        }),
        include: expect.any(Object),
        orderBy: { createdAt: 'asc' },
      });
    });
  });
});
