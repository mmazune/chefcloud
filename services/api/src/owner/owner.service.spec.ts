/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { OwnerService } from './owner.service';
import { PrismaService } from '../prisma.service';

describe('OwnerService', () => {
  let service: OwnerService;
  let mockTransporter: any;

  const mockPrismaService = {
    branch: {
      findMany: jest.fn(),
    },
    payment: {
      aggregate: jest.fn(),
      groupBy: jest.fn(),
    },
    orderItem: {
      findMany: jest.fn(),
    },
    discount: {
      aggregate: jest.fn(),
    },
    anomalyEvent: {
      count: jest.fn(),
    },
    ownerDigest: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: any) => {
      const config: any = {
        SMTP_HOST: 'localhost',
        SMTP_PORT: 1025,
        SMTP_USER: '',
        SMTP_PASS: '',
        SMTP_SECURE: 'false',
        DIGEST_FROM_EMAIL: 'test@chefcloud.local',
      };
      return config[key] !== undefined ? config[key] : defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        OwnerService,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<OwnerService>(OwnerService);

    // Mock the nodemailer transporter
    mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: 'test-message-id' }),
    };
    (service as any).transporter = mockTransporter;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getOverview', () => {
    it('should aggregate sales, top items, and anomalies', async () => {
      const orgId = 'org-1';

      mockPrismaService.branch.findMany.mockResolvedValue([{ id: 'branch-1' }, { id: 'branch-2' }]);

      mockPrismaService.payment.aggregate
        .mockResolvedValueOnce({ _sum: { amount: 100000 } }) // today
        .mockResolvedValueOnce({ _sum: { amount: 500000 } }) // 7 days
        .mockResolvedValue({ _sum: { amount: 50000 } }); // branch sales

      mockPrismaService.orderItem.findMany.mockResolvedValue([
        { menuItemId: 'item-1', quantity: 10, subtotal: 50000, menuItem: { name: 'Burger' } },
        { menuItemId: 'item-2', quantity: 5, subtotal: 25000, menuItem: { name: 'Fries' } },
        { menuItemId: 'item-1', quantity: 3, subtotal: 15000, menuItem: { name: 'Burger' } },
      ]);

      mockPrismaService.discount.aggregate.mockResolvedValue({
        _count: 5,
        _sum: { value: 25000 },
      });

      mockPrismaService.anomalyEvent.count
        .mockResolvedValueOnce(3) // voids
        .mockResolvedValueOnce(7); // anomalies

      mockPrismaService.payment.groupBy.mockResolvedValue([
        { method: 'CASH', _sum: { amount: 300000 } },
        { method: 'MOMO', _sum: { amount: 200000 } },
      ]);

      mockPrismaService.branch.findMany.mockResolvedValue([
        { id: 'branch-1', name: 'Main Branch' },
        { id: 'branch-2', name: 'Second Branch' },
      ]);

      const result = await service.getOverview(orgId);

      expect(result.salesToday).toBe('100000');
      expect(result.sales7d).toBe('500000');
      expect(result.topItems).toHaveLength(2);
      expect(result.topItems[0]).toEqual({ rank: 1, name: 'Burger', qty: 13, revenue: 65000 });
      expect(result.topItems[1]).toEqual({ rank: 2, name: 'Fries', qty: 5, revenue: 25000 });
      expect(result.discountsToday.count).toBe(5);
      expect(result.discountsToday.amount).toBe('25000');
      expect(result.voidsToday).toBe(3);
      expect(result.anomaliesToday).toBe(7);
      expect(result.paymentBreakdown).toEqual({
        CASH: '300000',
        MOMO: '200000',
      });
      expect(result.branchComparisons).toHaveLength(2);
    });
  });

  describe('createDigest', () => {
    it('should create a digest configuration', async () => {
      const expected = {
        id: 'digest-1',
        orgId: 'org-1',
        name: 'Daily Owner Report',
        cron: '0 8 * * *',
        recipients: ['owner@example.com'],
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      mockPrismaService.ownerDigest.create.mockResolvedValue(expected);

      const result = await service.createDigest(
        'org-1',
        'Daily Owner Report',
        '0 8 * * *',
        ['owner@example.com'],
        false,
      );

      expect(result).toEqual(expected);
      expect(mockPrismaService.ownerDigest.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          name: 'Daily Owner Report',
          cron: '0 8 * * *',
          recipients: ['owner@example.com'],
          sendOnShiftClose: false,
        },
      });
    });
  });

  describe('sendDigestEmail', () => {
    it('should send email via nodemailer with PDF and CSV attachments', async () => {
      const recipients = ['owner@example.com'];
      const orgName = 'Test Organization';
      const overview = {
        salesToday: '100000',
        sales7d: '500000',
        anomaliesToday: 3,
        voidsToday: 1,
        topItems: [{ name: 'Burger', qty: 10, revenue: 100.5 }],
      };

      await service.sendDigestEmail(recipients, orgName, overview);

      expect(mockTransporter.sendMail).toHaveBeenCalledTimes(1);

      const callArgs = mockTransporter.sendMail.mock.calls[0][0];
      expect(callArgs.from).toBe('test@chefcloud.local');
      expect(callArgs.to).toBe('owner@example.com');
      expect(callArgs.subject).toContain('Owner Digest - Test Organization');
      expect(callArgs.attachments).toHaveLength(4); // PDF + 3 CSVs
      expect(callArgs.attachments[0].contentType).toBe('application/pdf');
      expect(callArgs.attachments[1].filename).toBe('top-items.csv');
      expect(callArgs.attachments[2].filename).toBe('discounts.csv');
      expect(callArgs.attachments[3].filename).toBe('voids.csv');
    });
  });

  describe('buildTopItemsCSV', () => {
    it('should build CSV with headers and data rows', () => {
      const items = [
        { name: 'Burger', qty: 10, revenue: 100.5 },
        { name: 'Pizza', qty: 5, revenue: 75.25 },
      ];

      const csv = service.buildTopItemsCSV(items);

      expect(csv).toContain('name,qty,revenue');
      expect(csv).toContain('"Burger",10,100.50');
      expect(csv).toContain('"Pizza",5,75.25');
    });
  });
});
