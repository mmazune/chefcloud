/**
 * E39-s1: Tax Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TaxService } from './tax.service';
import { PrismaService } from '../prisma.service';

describe('TaxService', () => {
  let service: TaxService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              orgSettings: {
                findUnique: jest.fn(),
              },
              menuItem: {
                findUnique: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<TaxService>(TaxService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateTax - inclusive', () => {
    it('should calculate tax when tax is inclusive', () => {
      const rule = { code: 'VAT_STD', rate: 0.18, inclusive: true };
      const result = service.calculateTax(1180, rule);

      expect(result.gross).toBe(1180);
      expect(result.net).toBe(1000);
      expect(result.taxAmount).toBe(180);
    });

    it('should handle 15% alcohol tax inclusive', () => {
      const rule = { code: 'ALCOHOL', rate: 0.15, inclusive: true };
      const result = service.calculateTax(11500, rule);

      expect(result.gross).toBe(11500);
      expect(result.net).toBe(10000);
      expect(result.taxAmount).toBe(1500);
    });
  });

  describe('calculateTax - exclusive', () => {
    it('should calculate tax when tax is exclusive', () => {
      const rule = { code: 'VAT_STD', rate: 0.18, inclusive: false };
      const result = service.calculateTax(1000, rule);

      expect(result.net).toBe(1000);
      expect(result.taxAmount).toBe(180);
      expect(result.gross).toBe(1180);
    });

    it('should handle 10% service charge exclusive', () => {
      const rule = { code: 'SERVICE', rate: 0.1, inclusive: false };
      const result = service.calculateTax(5000, rule);

      expect(result.net).toBe(5000);
      expect(result.taxAmount).toBe(500);
      expect(result.gross).toBe(5500);
    });
  });

  describe('calculateServiceCharge', () => {
    it('should calculate service charge when enabled', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        taxMatrix: {
          serviceCharge: { rate: 0.1, inclusive: false },
        },
      } as any);

      const result = await service.calculateServiceCharge('org-1', 10000);

      expect(result.amount).toBe(1000);
      expect(result.inclusive).toBe(false);
    });

    it('should return zero when service charge not configured', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        taxMatrix: {
          defaultTax: { code: 'VAT', rate: 0.18, inclusive: true },
        },
      } as any);

      const result = await service.calculateServiceCharge('org-1', 10000);

      expect(result.amount).toBe(0);
      expect(result.inclusive).toBe(false);
    });
  });

  describe('applyRounding', () => {
    it('should round to nearest 50 for UGX', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        rounding: { cashRounding: 'NEAREST_50' },
      } as any);

      const result = await service.applyRounding('org-1', 1234, 'UGX');
      expect(result).toBe(1250);

      const result2 = await service.applyRounding('org-1', 1220, 'UGX');
      expect(result2).toBe(1200);
    });

    it('should round to nearest 100', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        rounding: { cashRounding: 'NEAREST_100' },
      } as any);

      const result = await service.applyRounding('org-1', 1234, 'UGX');
      expect(result).toBe(1200);

      const result2 = await service.applyRounding('org-1', 1260, 'UGX');
      expect(result2).toBe(1300);
    });

    it('should not apply cash rounding for USD', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        rounding: { cashRounding: 'NEAREST_50' },
      } as any);

      const result = await service.applyRounding('org-1', 12.34, 'USD');
      expect(result).toBe(12.34);
    });
  });
});
