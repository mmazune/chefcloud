/**
 * M9.1: ReservationsService Tests
 * 
 * Tests for core reservation functionality including:
 * - State transitions (HELD → CONFIRMED → SEATED → COMPLETED)
 * - Deposit handling
 * - Overlap detection
 * - No-show processing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../prisma.service';

describe('ReservationsService', () => {
  let service: ReservationsService;

  const mockPrismaService = {
    reservation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    client: {
      orgSettings: {
        findUnique: jest.fn(),
      },
      reservationReminder: {
        create: jest.fn(),
      },
      table: {
        findMany: jest.fn(),
      },
      floorPlan: {
        findMany: jest.fn(),
      },
    },
    paymentIntent: {
      create: jest.fn(),
      update: jest.fn(),
    },
    refund: {
      create: jest.fn(),
    },
    order: {
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a reservation without deposit', async () => {
      const orgId = 'org-1';
      const dto = {
        branchId: 'branch-1',
        name: 'John Doe',
        phone: '+256700000000',
        partySize: 4,
        startAt: new Date('2025-12-01T19:00:00Z').toISOString(),
        endAt: new Date('2025-12-01T21:00:00Z').toISOString(),
      };

      mockPrismaService.client.orgSettings.findUnique.mockResolvedValue({
        reservationHoldMinutes: 30,
      });

      mockPrismaService.reservation.findFirst.mockResolvedValue(null); // No overlap

      const createdReservation = {
        id: 'res-1',
        ...dto,
        orgId,
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: 'HELD',
        source: 'PHONE',
        deposit: 0,
        depositStatus: 'NONE',
      };

      mockPrismaService.reservation.create.mockResolvedValue(createdReservation);

      const result = await service.create(orgId, dto as any);

      expect(result.status).toBe('HELD');
      expect(result.depositStatus).toBe('NONE');
    });

    it('should throw ConflictException for overlapping reservations', async () => {
      const orgId = 'org-1';
      const dto = {
        branchId: 'branch-1',
        tableId: 'table-1',
        name: 'John Doe',
        phone: '+256700000000',
        partySize: 4,
        startAt: new Date('2025-12-01T19:00:00Z').toISOString(),
        endAt: new Date('2025-12-01T21:00:00Z').toISOString(),
      };

      mockPrismaService.reservation.findFirst.mockResolvedValue({
        id: 'existing-res',
        tableId: 'table-1',
        startAt: new Date('2025-12-01T18:30:00Z'),
        endAt: new Date('2025-12-01T20:30:00Z'),
      });

      await expect(service.create(orgId, dto as any)).rejects.toThrow(ConflictException);
    });
  });

  describe('confirm', () => {
    it('should confirm a HELD reservation', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      const heldReservation = {
        id: reservationId,
        orgId,
        branchId: 'branch-1',
        status: 'HELD',
        depositStatus: 'NONE',
        deposit: 0,
        name: 'John Doe',
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(heldReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...heldReservation,
        status: 'CONFIRMED',
      });

      const result = await service.confirm(orgId, reservationId);

      expect(result.status).toBe('CONFIRMED');
      expect(mockPrismaService.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: expect.objectContaining({
          status: 'CONFIRMED',
          autoCancelAt: null,
        }),
      });
    });

    it('should throw ConflictException if not in HELD status', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId,
        status: 'CONFIRMED',
        depositStatus: 'CAPTURED',
      });

      await expect(service.confirm(orgId, reservationId)).rejects.toThrow(ConflictException);
    });
  });

  describe('seat', () => {
    it('should seat a CONFIRMED reservation', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      const confirmedReservation = {
        id: reservationId,
        orgId,
        status: 'CONFIRMED',
        tableId: 'table-1',
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(confirmedReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...confirmedReservation,
        status: 'SEATED',
        seatedAt: new Date(),
      });

      const result = await service.seat(orgId, reservationId);

      expect(result.status).toBe('SEATED');
      expect(result.seatedAt).toBeDefined();
    });

    it('should link order to table when orderId provided', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';
      const orderId = 'order-1';

      const confirmedReservation = {
        id: reservationId,
        orgId,
        status: 'CONFIRMED',
        tableId: 'table-1',
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(confirmedReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...confirmedReservation,
        status: 'SEATED',
        seatedAt: new Date(),
      });
      mockPrismaService.order.update.mockResolvedValue({});

      await service.seat(orgId, reservationId, orderId);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { tableId: 'table-1' },
      });
    });

    it('should throw ConflictException if already seated', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId,
        status: 'SEATED',
      });

      await expect(service.seat(orgId, reservationId)).rejects.toThrow(ConflictException);
    });
  });

  describe('complete', () => {
    it('should complete a SEATED reservation', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      const seatedReservation = {
        id: reservationId,
        orgId,
        status: 'SEATED',
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(seatedReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...seatedReservation,
        status: 'COMPLETED',
        completedAt: new Date(),
      });

      const result = await service.complete(orgId, reservationId);

      expect(result.status).toBe('COMPLETED');
      expect(result.completedAt).toBeDefined();
    });

    it('should throw ConflictException if not SEATED', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId,
        status: 'CONFIRMED',
      });

      await expect(service.complete(orgId, reservationId)).rejects.toThrow(ConflictException);
    });
  });

  describe('noShow', () => {
    it('should mark reservation as NO_SHOW', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';
      const userId = 'user-1';

      const confirmedReservation = {
        id: reservationId,
        orgId,
        branchId: 'branch-1',
        status: 'CONFIRMED',
        depositStatus: 'CAPTURED',
        deposit: 50,
        name: 'John Doe',
        startAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(confirmedReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...confirmedReservation,
        status: 'NO_SHOW',
      });

      const result = await service.noShow(orgId, reservationId, { reason: 'Customer did not arrive' }, userId);

      expect(result.status).toBe('NO_SHOW');
    });

    it('should throw ConflictException if SEATED', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId,
        status: 'SEATED',
      });

      await expect(service.noShow(orgId, reservationId)).rejects.toThrow(ConflictException);
    });
  });

  describe('cancel', () => {
    it('should cancel a CONFIRMED reservation with reason', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';
      const userId = 'user-1';

      const confirmedReservation = {
        id: reservationId,
        orgId,
        branchId: 'branch-1',
        status: 'CONFIRMED',
        depositStatus: 'NONE',
        deposit: 0,
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(confirmedReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...confirmedReservation,
        status: 'CANCELLED',
        cancellationReason: 'Customer request',
      });

      const result = await service.cancel(orgId, reservationId, { reason: 'Customer request' }, userId);

      expect(result.status).toBe('CANCELLED');
      expect(result.cancellationReason).toBe('Customer request');
    });

    it('should throw ConflictException if SEATED or COMPLETED', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId,
        status: 'SEATED',
      });

      await expect(service.cancel(orgId, reservationId)).rejects.toThrow(ConflictException);
    });
  });

  describe('findOne', () => {
    it('should return reservation with relations', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      const reservation = {
        id: reservationId,
        orgId,
        name: 'John Doe',
        status: 'CONFIRMED',
        table: { id: 'table-1', label: 'T1' },
        branch: { id: 'branch-1', name: 'Main Branch' },
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(reservation);

      const result = await service.findOne(orgId, reservationId);

      expect(result.name).toBe('John Doe');
      expect(result.table).toBeDefined();
    });

    it('should throw NotFoundException if not found', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue(null);

      await expect(service.findOne(orgId, reservationId)).rejects.toThrow(NotFoundException);
    });

    it('should throw NotFoundException if wrong org', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId: 'different-org',
      });

      await expect(service.findOne(orgId, reservationId)).rejects.toThrow(NotFoundException);
    });
  });
});
