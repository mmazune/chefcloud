/**
 * E42-s2: BookingsService PDF Generation Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { PrismaService } from '../prisma.service';

describe('BookingsService - E42-s2 PDF Generation', () => {
  let service: BookingsService;
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
    $transaction: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BookingsService,
        {
          provide: PrismaService,
          useValue: {
            client: mockPrismaClient,
          },
        },
      ],
    }).compile();

    service = module.get<BookingsService>(BookingsService);
    prisma = mockPrismaClient;

    jest.clearAllMocks();
  });

  describe('generateTicketPdf', () => {
    it('should generate PDF with QR code (smoke test: bytes > 0)', async () => {
      const mockBooking = {
        id: 'booking-1',
        ticketCode: 'TEST_TICKET_CODE_12345',
        name: 'John Doe',
        event: {
          title: 'New Year Gala 2025',
          startsAt: new Date('2025-12-31T18:00:00Z'),
          endsAt: new Date('2025-12-31T23:59:00Z'),
        },
        eventTable: {
          label: 'VIP-1',
        },
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      const pdfBuffer = await service.generateTicketPdf('booking-1');

      expect(pdfBuffer).toBeInstanceOf(Buffer);
      expect(pdfBuffer.length).toBeGreaterThan(0);
      expect(pdfBuffer.toString('utf8', 0, 4)).toBe('%PDF'); // PDF magic number
    });

    it('should throw NotFoundException if booking not found', async () => {
      prisma.eventBooking.findUnique.mockResolvedValue(null);

      await expect(service.generateTicketPdf('invalid-id')).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException if booking has no ticket code', async () => {
      const mockBooking = {
        id: 'booking-1',
        ticketCode: null,
        name: 'John Doe',
        event: { title: 'Event' },
        eventTable: { label: 'Table 1' },
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);

      await expect(service.generateTicketPdf('booking-1')).rejects.toThrow(BadRequestException);
    });
  });

  describe('confirmBooking - E42-s2 ticket code generation', () => {
    it('should generate ticketCode on confirmation', async () => {
      const mockBooking = {
        id: 'booking-1',
        status: 'HELD',
        creditTotal: 100,
        event: {
          orgId: 'org-1',
          branchId: 'branch-1',
          endsAt: new Date(),
        },
        eventTable: {},
      };

      prisma.eventBooking.findUnique.mockResolvedValue(mockBooking);
      prisma.orgSettings.findUnique.mockResolvedValue({
        bookingPolicies: { creditExpiryHours: 12 },
      });

      const mockUpdatedBooking = { ...mockBooking, status: 'CONFIRMED', ticketCode: 'MOCK_ULID' };
      const mockCredit = { id: 'credit-1', amount: 100 };

      // Mock transaction to return [booking, credit]
      prisma.$transaction.mockResolvedValue([mockUpdatedBooking, mockCredit]);

      const result = await service.confirmBooking('booking-1', 'user-1');

      expect(prisma.$transaction).toHaveBeenCalled();
      expect(result.booking.ticketCode).toBeDefined();
      expect(result.booking.ticketCode.length).toBeGreaterThan(0);
    });
  });
});
