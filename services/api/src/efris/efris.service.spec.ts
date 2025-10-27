import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { EfrisService } from './efris.service';
import { PrismaService } from '../prisma.service';

describe('EfrisService', () => {
  let service: EfrisService;

  const mockOrder = {
    id: 'order-123',
    branchId: 'branch-1',
    total: 25000,
    branch: {
      orgId: 'org-1',
    },
    orderItems: [
      {
        quantity: 1,
        price: 15000,
        menuItem: {
          name: 'Burger',
          taxCategory: {
            efirsTaxCode: 'FOOD',
            rate: 18,
          },
        },
      },
      {
        quantity: 1,
        price: 10000,
        menuItem: {
          name: 'Fries',
          taxCategory: {
            efirsTaxCode: null,
            rate: 18,
          },
        },
      },
    ],
  };

  const mockPrismaService = {
    client: {
      order: {
        findUnique: jest.fn(),
      },
    },
    fiscalInvoice: {
      upsert: jest.fn(),
    },
  };

  const mockConfigService = {
    get: jest.fn((key: string, defaultValue?: string) => {
      const values: Record<string, string> = {
        EFRIS_TIN: '1000000000',
        EFRIS_DEVICE: 'DEV001',
        FISCAL_ENABLED: 'false',
        FISCAL_FORCE_SUCCESS: 'true',
      };
      return values[key] || defaultValue;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EfrisService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<EfrisService>(EfrisService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('buildPayload', () => {
    it('should map burger+fries order with 18% tax', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(mockOrder);

      const payload = await service.buildPayload('order-123');

      expect(payload).toEqual({
        tin: '1000000000',
        deviceCode: 'DEV001',
        orderId: 'order-123',
        items: [
          {
            name: 'Burger',
            qty: 1,
            unitPrice: 15000,
            taxCode: 'FOOD',
            taxRate: 18,
          },
          {
            name: 'Fries',
            qty: 1,
            unitPrice: 10000,
            taxCode: 'STD', // fallback
            taxRate: 18,
          },
        ],
        total: 25000,
      });
    });

    it('should throw error if order not found', async () => {
      mockPrismaService.client.order.findUnique.mockResolvedValue(null);

      await expect(service.buildPayload('nonexistent')).rejects.toThrow(
        'Order not found',
      );
    });
  });

  describe('push', () => {
    it('should simulate success and upsert FiscalInvoice', async () => {
      mockPrismaService.client.order.findUnique
        .mockResolvedValueOnce(mockOrder)
        .mockResolvedValueOnce(mockOrder);
      mockPrismaService.fiscalInvoice.upsert.mockResolvedValue({
        id: 'fiscal-1',
        orderId: 'order-123',
        status: 'SENT',
      });

      const result = await service.push('order-123');

      expect(result.status).toBe('SENT');
      expect(mockPrismaService.fiscalInvoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { orderId: 'order-123' },
          create: expect.objectContaining({
            orderId: 'order-123',
            orgId: 'org-1',
            branchId: 'branch-1',
            status: 'SENT',
            efirsTin: '1000000000',
            deviceCode: 'DEV001',
            attempts: 1,
          }),
          update: expect.objectContaining({
            status: 'SENT',
          }),
        }),
      );
    });
  });
});
