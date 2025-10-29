/**
 * E39-s1: Currency Service Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { CurrencyService } from './currency.service';
import { PrismaService } from '../prisma.service';

describe('CurrencyService', () => {
  let service: CurrencyService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CurrencyService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              orgSettings: {
                findUnique: jest.fn(),
              },
              branch: {
                findUnique: jest.fn(),
              },
              exchangeRate: {
                findFirst: jest.fn(),
              },
              currency: {
                findUnique: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<CurrencyService>(CurrencyService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getOrgCurrency', () => {
    it('should return baseCurrencyCode when set', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        baseCurrencyCode: 'USD',
        currency: 'UGX',
      } as any);

      const result = await service.getOrgCurrency('org-1');
      expect(result).toBe('USD');
    });

    it('should fallback to currency field', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        baseCurrencyCode: null,
        currency: 'UGX',
      } as any);

      const result = await service.getOrgCurrency('org-1');
      expect(result).toBe('UGX');
    });

    it('should default to UGX', async () => {
      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue(null);

      const result = await service.getOrgCurrency('org-1');
      expect(result).toBe('UGX');
    });
  });

  describe('getBranchCurrency', () => {
    it('should return branch currencyCode when set', async () => {
      jest.spyOn(prisma.client.branch, 'findUnique').mockResolvedValue({
        id: 'branch-1',
        currencyCode: 'EUR',
        orgId: 'org-1',
      } as any);

      const result = await service.getBranchCurrency('branch-1');
      expect(result).toBe('EUR');
    });

    it('should fallback to org currency', async () => {
      jest.spyOn(prisma.client.branch, 'findUnique').mockResolvedValue({
        id: 'branch-1',
        currencyCode: null,
        orgId: 'org-1',
      } as any);

      jest.spyOn(prisma.client.orgSettings, 'findUnique').mockResolvedValue({
        baseCurrencyCode: 'USD',
        currency: 'UGX',
      } as any);

      const result = await service.getBranchCurrency('branch-1');
      expect(result).toBe('USD');
    });

    it('should throw if branch not found', async () => {
      jest.spyOn(prisma.client.branch, 'findUnique').mockResolvedValue(null);

      await expect(service.getBranchCurrency('invalid')).rejects.toThrow(NotFoundException);
    });
  });

  describe('convert', () => {
    it('should return same amount for same currency', async () => {
      const result = await service.convert(1000, 'UGX', 'UGX');
      expect(result).toBe(1000);
    });

    it('should convert UGX to USD', async () => {
      jest.spyOn(prisma.client.exchangeRate, 'findFirst').mockResolvedValue({
        baseCode: 'UGX',
        quoteCode: 'USD',
        rate: 3700,
        asOf: new Date(),
      } as any);

      const result = await service.convert(3700, 'UGX', 'USD');
      expect(result).toBe(13690000); // 3700 * 3700
    });

    it('should use inverse rate if direct rate not found', async () => {
      jest
        .spyOn(prisma.client.exchangeRate, 'findFirst')
        .mockResolvedValueOnce(null)
        .mockResolvedValueOnce({
          baseCode: 'USD',
          quoteCode: 'UGX',
          rate: 3700,
          asOf: new Date(),
        } as any);

      const result = await service.convert(3700, 'UGX', 'USD');
      expect(result).toBe(1); // 3700 / 3700
    });

    it('should throw if no rate found', async () => {
      jest.spyOn(prisma.client.exchangeRate, 'findFirst').mockResolvedValue(null);

      await expect(service.convert(100, 'UGX', 'JPY')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getCurrencyInfo', () => {
    it('should return currency metadata', async () => {
      jest.spyOn(prisma.client.currency, 'findUnique').mockResolvedValue({
        code: 'USD',
        name: 'US Dollar',
        symbol: '$',
        decimals: 2,
      } as any);

      const result = await service.getCurrencyInfo('USD');
      expect(result.code).toBe('USD');
      expect(result.symbol).toBe('$');
      expect(result.decimals).toBe(2);
    });

    it('should throw if currency not found', async () => {
      jest.spyOn(prisma.client.currency, 'findUnique').mockResolvedValue(null);

      await expect(service.getCurrencyInfo('INVALID')).rejects.toThrow(NotFoundException);
    });
  });
});
