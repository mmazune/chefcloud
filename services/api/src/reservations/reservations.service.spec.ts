/**
 * M15: ReservationsService Tests
 * 
 * Tests for core reservation functionality including:
 * - State transitions
 * - Deposit handling
 * - Capacity checks
 * - No-show processing
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException, ForbiddenException } from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { DepositAccountingService } from './deposit-accounting.service';
import { PrismaService } from '../prisma.service';
import { ReservationStatus, DepositStatus } from '@prisma/client';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prismaService: PrismaService;
  let depositAccounting: DepositAccountingService;

  const mockPrismaService = {
    reservation: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    branch: {
      findUnique: jest.fn(),
    },
    client: {
      orgSettings: {
        findUnique: jest.fn(),
      },
      reservationReminder: {
        create: jest.fn(),
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

  const mockDepositAccounting = {
    recordDepositCollection: jest.fn(),
    applyDepositToBill: jest.fn(),
    forfeitDeposit: jest.fn(),
    refundDeposit: jest.fn(),
    partialRefundDeposit: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: DepositAccountingService,
          useValue: mockDepositAccounting,
        },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
    prismaService = module.get<PrismaService>(PrismaService);
    depositAccounting = module.get<DepositAccountingService>(DepositAccountingService);

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
        startAt: new Date(dto.startAt),
        endAt: new Date(dto.endAt),
        status: ReservationStatus.HELD,
        deposit: 0,
        depositStatus: DepositStatus.NONE,
      };

      mockPrismaService.reservation.create.mockResolvedValue(createdReservation);

      const result = await service.create(orgId, dto as any);

      expect(result.status).toBe(ReservationStatus.HELD);
      expect(result.depositStatus).toBe(DepositStatus.NONE);
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
    it('should confirm a HELD reservation and post GL entry for deposit', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      const heldReservation = {
        id: reservationId,
        orgId,
        branchId: 'branch-1',
        status: ReservationStatus.HELD,
        depositStatus: DepositStatus.HELD,
        deposit: 50,
        name: 'John Doe',
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(heldReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...heldReservation,
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.CAPTURED,
      });

      await service.confirm(orgId, reservationId);

      expect(depositAccounting.recordDepositCollection).toHaveBeenCalledWith({
        orgId,
        branchId: 'branch-1',
        reservationId,
        amount: 50,
        description: expect.stringContaining('John Doe'),
      });

      expect(mockPrismaService.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: expect.objectContaining({
          status: ReservationStatus.CONFIRMED,
          depositStatus: DepositStatus.CAPTURED,
        }),
      });
    });

    it('should throw ConflictException if not in HELD status', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';

      mockPrismaService.reservation.findUnique.mockResolvedValue({
        id: reservationId,
        orgId,
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.CAPTURED,
      });

      await expect(service.confirm(orgId, reservationId)).rejects.toThrow(ConflictException);
    });
  });

  describe('noShow', () => {
    it('should mark reservation as NO_SHOW and forfeit deposit', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';
      const userId = 'user-1';

      const pastReservation = {
        id: reservationId,
        orgId,
        branchId: 'branch-1',
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.CAPTURED,
        deposit: 50,
        name: 'John Doe',
        startAt: new Date(Date.now() - 60 * 60 * 1000), // 1 hour ago
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(pastReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...pastReservation,
        status: ReservationStatus.NO_SHOW,
        depositStatus: DepositStatus.FORFEITED,
        noShowAt: new Date(),
      });

      await service.noShow(orgId, reservationId, userId);

      expect(depositAccounting.forfeitDeposit).toHaveBeenCalledWith({
        orgId,
        branchId: 'branch-1',
        reservationId,
        amount: 50,
        description: expect.stringContaining('no show'),
      });

      expect(mockPrismaService.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: expect.objectContaining({
          status: ReservationStatus.NO_SHOW,
          depositStatus: DepositStatus.FORFEITED,
          cancelledBy: userId,
          cancelReason: 'NO_SHOW',
        }),
      });
    });

    it('should throw ForbiddenException if within grace period', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';
      const userId = 'user-1';

      const recentReservation = {
        id: reservationId,
        orgId,
        status: ReservationStatus.CONFIRMED,
        depositStatus: DepositStatus.CAPTURED,
        deposit: 50,
        startAt: new Date(Date.now() - 5 * 60 * 1000), // 5 minutes ago (within 15min grace)
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(recentReservation);

      await expect(service.noShow(orgId, reservationId, userId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('checkAvailability', () => {
    it('should return availability for requested time slot', async () => {
      const branchId = 'branch-1';
      const dateTime = new Date('2025-12-01T19:00:00Z');
      const partySize = 4;

      mockPrismaService.branch.findUnique.mockResolvedValue({
        totalSeats: 50,
      });

      mockPrismaService.reservation.findMany.mockResolvedValue([
        { partySize: 6 },
        { partySize: 4 },
        { partySize: 8 },
      ]);

      const result = await service.checkAvailability({
        branchId,
        dateTime,
        partySize,
      });

      expect(result.available).toBe(true);
      expect(result.totalSeats).toBe(50);
      expect(result.occupiedSeats).toBe(18);
      expect(result.availableSeats).toBe(32);
    });

    it('should return unavailable when capacity exceeded', async () => {
      const branchId = 'branch-1';
      const dateTime = new Date('2025-12-01T19:00:00Z');
      const partySize = 10;

      mockPrismaService.branch.findUnique.mockResolvedValue({
        totalSeats: 20,
      });

      mockPrismaService.reservation.findMany.mockResolvedValue([
        { partySize: 8 },
        { partySize: 6 },
      ]);

      const result = await service.checkAvailability({
        branchId,
        dateTime,
        partySize,
      });

      expect(result.available).toBe(false);
      expect(result.occupiedSeats).toBe(14);
      expect(result.availableSeats).toBe(6);
    });
  });

  describe('seat', () => {
    it('should seat a CONFIRMED reservation and link to order', async () => {
      const orgId = 'org-1';
      const reservationId = 'res-1';
      const orderId = 'order-1';

      const confirmedReservation = {
        id: reservationId,
        orgId,
        status: ReservationStatus.CONFIRMED,
        tableId: 'table-1',
      };

      mockPrismaService.reservation.findUnique.mockResolvedValue(confirmedReservation);
      mockPrismaService.reservation.update.mockResolvedValue({
        ...confirmedReservation,
        status: ReservationStatus.SEATED,
        orderId,
        seatedAt: new Date(),
      });
      mockPrismaService.order.update.mockResolvedValue({});

      await service.seat(orgId, reservationId, orderId);

      expect(mockPrismaService.order.update).toHaveBeenCalledWith({
        where: { id: orderId },
        data: { tableId: 'table-1' },
      });

      expect(mockPrismaService.reservation.update).toHaveBeenCalledWith({
        where: { id: reservationId },
        data: expect.objectContaining({
          status: ReservationStatus.SEATED,
          orderId,
        }),
      });
    });
  });
});
