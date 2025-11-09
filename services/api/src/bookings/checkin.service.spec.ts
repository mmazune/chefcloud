/**
 * E42-s2: Check-in Service Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { CheckinService } from './checkin.service';
import { PrismaService } from '../prisma.service';

describe('CheckinService', () => {
  let service: CheckinService;
  let prisma: any;

  const mockPrismaClient = {
    eventBooking: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    prepaidCredit: {
      create: jest.fn(),
    },
    orgSettings: {
      findUnique: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckinService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<CheckinService>(CheckinService);
    prisma = mockPrismaClient;

    jest.clearAllMocks();
  });

  describe('checkin', () => {
    it('should successfully check in a valid booking', async () => {
      const ticketCode = 'TEST_TICKET_CODE';
      const userId = 'user-1';
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000); // 1 hour ago
      const endTime = new Date(now.getTime() + 3600000); // 1 hour from now

      const mockBooking = {
        id: 'booking-1',
        ticketCode,
        status: 'CONFIRMED',
        checkedInAt: null,
        creditTotal: 100,
        event: {
          orgId: 'org-1',
          branchId: 'branch-1',
          startsAt: startTime,
          endsAt: endTime,
        },
        eventTable: { label: 'VIP-1' },
        credits: [
          {
            id: 'credit-1',
            amount: 100,
            consumed: 20,
            expiresAt: new Date(now.getTime() + 86400000),
          },
        ],
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);
      prisma.eventBooking.update.mockResolvedValue({
        ...mockBooking,
        checkedInAt: now,
        checkedInById: userId,
      });

      const result = await service.checkin(ticketCode, userId);

      expect(prisma.eventBooking.findUnique).toHaveBeenCalledWith({
        where: { ticketCode },
        include: { event: true, eventTable: true, credits: true },
      });
      expect(prisma.eventBooking.update).toHaveBeenCalledWith({
        where: { id: mockBooking.id },
        data: { checkedInAt: expect.any(Date), checkedInById: userId },
      });
      expect(result.credit.remaining).toBe(80); // 100 - 20
    });

    it('should throw NotFoundException for invalid ticket code', async () => {
      prisma.eventBooking.findUnique.mockResolvedValue(null);

      await expect(service.checkin('INVALID_CODE', 'user-1')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if booking not CONFIRMED', async () => {
      const mockBooking = {
        id: 'booking-1',
        ticketCode: 'TEST_CODE',
        status: 'HELD',
        checkedInAt: null,
        event: { startsAt: new Date(), endsAt: new Date() },
        eventTable: {},
        credits: [],
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.checkin('TEST_CODE', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if already checked in', async () => {
      const mockBooking = {
        id: 'booking-1',
        ticketCode: 'TEST_CODE',
        status: 'CONFIRMED',
        checkedInAt: new Date(),
        event: { startsAt: new Date(), endsAt: new Date() },
        eventTable: {},
        credits: [],
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.checkin('TEST_CODE', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if event not started', async () => {
      const now = new Date();
      const futureStart = new Date(now.getTime() + 3600000); // 1 hour from now

      const mockBooking = {
        id: 'booking-1',
        ticketCode: 'TEST_CODE',
        status: 'CONFIRMED',
        checkedInAt: null,
        event: {
          startsAt: futureStart,
          endsAt: new Date(futureStart.getTime() + 7200000),
        },
        eventTable: {},
        credits: [],
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.checkin('TEST_CODE', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if event already ended', async () => {
      const now = new Date();
      const pastEnd = new Date(now.getTime() - 3600000); // 1 hour ago

      const mockBooking = {
        id: 'booking-1',
        ticketCode: 'TEST_CODE',
        status: 'CONFIRMED',
        checkedInAt: null,
        event: {
          startsAt: new Date(pastEnd.getTime() - 7200000),
          endsAt: pastEnd,
        },
        eventTable: {},
        credits: [],
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.checkin('TEST_CODE', 'user-1')).rejects.toThrow(BadRequestException);
    });

    it('should create PrepaidCredit if missing (idempotent)', async () => {
      const ticketCode = 'TEST_TICKET_CODE';
      const userId = 'user-1';
      const now = new Date();
      const startTime = new Date(now.getTime() - 3600000);
      const endTime = new Date(now.getTime() + 3600000);

      const mockBooking = {
        id: 'booking-1',
        ticketCode,
        status: 'CONFIRMED',
        checkedInAt: null,
        creditTotal: 100,
        event: {
          orgId: 'org-1',
          branchId: 'branch-1',
          startsAt: startTime,
          endsAt: endTime,
        },
        eventTable: { label: 'VIP-1' },
        credits: [], // No credit exists
      };

      const mockCredit = {
        id: 'credit-new',
        amount: 100,
        consumed: 0,
        expiresAt: new Date(endTime.getTime() + 43200000), // +12h
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);
      prisma.eventBooking.update.mockResolvedValue({
        ...mockBooking,
        checkedInAt: now,
        checkedInById: userId,
      });
      prisma.orgSettings.findUnique.mockResolvedValue({
        bookingPolicies: { creditExpiryHours: 12 },
      });
      prisma.prepaidCredit.create.mockResolvedValue(mockCredit);

      const result = await service.checkin(ticketCode, userId);

      expect(prisma.prepaidCredit.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          branchId: 'branch-1',
          eventBookingId: 'booking-1',
          amount: 100,
          consumed: 0,
          expiresAt: expect.any(Date),
        },
      });
      expect(result.credit.remaining).toBe(100);
    });
  });

  describe('getBookingForTicket', () => {
    it('should return booking details', async () => {
      const mockBooking = {
        id: 'booking-1',
        event: { title: 'Test Event' },
        eventTable: { label: 'VIP-1' },
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      const result = await service.getBookingForTicket('booking-1');

      expect(result).toEqual(mockBooking);
    });

    it('should throw NotFoundException for invalid booking ID', async () => {
      prisma.eventBooking.findUnique.mockResolvedValue(null);

      await expect(service.getBookingForTicket('invalid-id')).rejects.toThrow(NotFoundException);
    });
  });
});
