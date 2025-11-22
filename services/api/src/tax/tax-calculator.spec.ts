/**
 * M17-s3: Tax Calculator Service - Unit Tests
 */

import { Test, TestingModule } from '@nestjs/testing';
import { TaxCalculatorService } from './tax-calculator.service';
import { TaxService } from './tax.service';
import { CurrencyService } from '../currency/currency.service';
import { PrismaService } from '../prisma.service';

describe('TaxCalculatorService', () => {
  let service: TaxCalculatorService;
  let taxService: TaxService;
  let currencyService: CurrencyService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TaxCalculatorService,
        {
          provide: TaxService,
          useValue: {
            resolveLineTax: jest.fn(),
            calculateTax: jest.fn(),
            calculateServiceCharge: jest.fn(),
            applyRounding: jest.fn(),
            getTaxMatrix: jest.fn(),
          },
        },
        {
          provide: CurrencyService,
          useValue: {
            getBranchCurrency: jest.fn(),
          },
        },
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<TaxCalculatorService>(TaxCalculatorService);
    taxService = module.get<TaxService>(TaxService);
    currencyService = module.get<CurrencyService>(CurrencyService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateOrderTotals', () => {
    it('should calculate order totals with tax-inclusive items', async () => {
      // Mock tax rule resolution
      jest.spyOn(taxService, 'resolveLineTax').mockResolvedValue({
        code: 'VAT_STD',
        rate: 0.18,
        inclusive: true,
      });

      // Mock tax calculation (18% VAT inclusive)
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount / 1.18;
        const tax = amount - net;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: amount,
        };
      });

      // Mock service charge (10% on net)
      jest.spyOn(taxService, 'calculateServiceCharge').mockResolvedValue({
        amount: 847.46, // 10% of 8474.58 net
        inclusive: false,
      });

      // Mock currency
      jest.spyOn(currencyService, 'getBranchCurrency').mockResolvedValue('UGX');

      // Mock rounding (nearest 50 UGX)
      jest.spyOn(taxService, 'applyRounding').mockImplementation((_, amount) => {
        return Math.round(amount / 50) * 50;
      });

      const result = await service.calculateOrderTotals({
        orgId: 'org-1',
        branchId: 'branch-1',
        items: [
          { itemId: 'item-1', price: 5900, quantity: 1 }, // Net: 5000, Tax: 900
          { itemId: 'item-2', price: 5900, quantity: 1 }, // Net: 5000, Tax: 900
        ],
      });

      // Subtotal: 11,800 gross = 10,000 net + 1,800 tax
      expect(result.subtotal.gross).toBe(11800);
      expect(result.subtotal.net).toBe(10000);
      expect(result.subtotal.tax).toBe(1800);

      // Service charge: 10% of net = 1,000
      expect(result.serviceCharge.amount).toBe(847.46);
      expect(result.serviceCharge.inclusive).toBe(false);

      // Total: 10,000 net + 1,800 tax + 1,000 service = 12,800 gross
      expect(result.total.net).toBe(10000);
      expect(result.total.tax).toBe(1800);

      // Final total with rounding
      expect(result.finalTotal).toBeGreaterThan(0);
    });

    it('should calculate order totals with tax-exclusive items', async () => {
      // Mock tax rule resolution
      jest.spyOn(taxService, 'resolveLineTax').mockResolvedValue({
        code: 'VAT_STD',
        rate: 0.18,
        inclusive: false,
      });

      // Mock tax calculation (18% VAT exclusive)
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount;
        const tax = amount * 0.18;
        const gross = net + tax;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: Math.round(gross * 100) / 100,
        };
      });

      // Mock service charge
      jest.spyOn(taxService, 'calculateServiceCharge').mockResolvedValue({
        amount: 1000,
        inclusive: false,
      });

      // Mock currency
      jest.spyOn(currencyService, 'getBranchCurrency').mockResolvedValue('USD');

      // Mock rounding (no rounding for USD)
      jest.spyOn(taxService, 'applyRounding').mockImplementation((_, amount) => {
        return Math.round(amount * 100) / 100;
      });

      const result = await service.calculateOrderTotals({
        orgId: 'org-1',
        branchId: 'branch-1',
        items: [
          { itemId: 'item-1', price: 10, quantity: 1 }, // Net: 10, Tax: 1.8, Gross: 11.8
        ],
      });

      // Subtotal: 10 net + 1.8 tax = 11.8 gross
      expect(result.subtotal.net).toBe(10);
      expect(result.subtotal.tax).toBe(1.8);
      expect(result.subtotal.gross).toBe(11.8);

      // Service charge: 1,000
      expect(result.serviceCharge.amount).toBe(1000);

      // Total: 10 net + 1.8 tax + 1,000 service = 1,011.8 gross
      expect(result.total.net).toBe(10);
      expect(result.total.tax).toBe(1.8);
      expect(result.total.gross).toBe(1011.8);
    });

    it('should handle discount correctly', async () => {
      // Mock tax rule
      jest.spyOn(taxService, 'resolveLineTax').mockResolvedValue({
        code: 'VAT_STD',
        rate: 0.18,
        inclusive: true,
      });

      // Mock tax calculation
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount / 1.18;
        const tax = amount - net;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: amount,
        };
      });

      // Mock service charge (on discounted net)
      jest.spyOn(taxService, 'calculateServiceCharge').mockResolvedValue({
        amount: 900, // 10% of 9,000 (10,000 - 1,000 discount)
        inclusive: false,
      });

      // Mock currency
      jest.spyOn(currencyService, 'getBranchCurrency').mockResolvedValue('UGX');

      // Mock rounding
      jest.spyOn(taxService, 'applyRounding').mockImplementation((_, amount) => amount);

      const result = await service.calculateOrderTotals({
        orgId: 'org-1',
        branchId: 'branch-1',
        items: [
          { itemId: 'item-1', price: 11800, quantity: 1 }, // Net: 10,000, Tax: 1,800
        ],
        discountAmount: 1000,
      });

      // Discount applied to net
      expect(result.discount).toBe(1000);
      expect(result.total.net).toBe(9000); // 10,000 - 1,000
      expect(result.total.tax).toBe(1800); // Tax remains on full amount
    });

    it('should handle multiple items with different tax rates', async () => {
      // Mock tax rule resolution (different rates per item)
      jest
        .spyOn(taxService, 'resolveLineTax')
        .mockResolvedValueOnce({
          code: 'VAT_STD',
          rate: 0.18,
          inclusive: true,
        })
        .mockResolvedValueOnce({
          code: 'ALCOHOL_EXCISE',
          rate: 0.15,
          inclusive: true,
        });

      // Mock tax calculation
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount, rule) => {
        if (rule.inclusive) {
          const net = amount / (1 + rule.rate);
          const tax = amount - net;
          return {
            net: Math.round(net * 100) / 100,
            taxAmount: Math.round(tax * 100) / 100,
            gross: amount,
          };
        }
        const net = amount;
        const tax = amount * rule.rate;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: Math.round((net + tax) * 100) / 100,
        };
      });

      // Mock service charge
      jest.spyOn(taxService, 'calculateServiceCharge').mockResolvedValue({
        amount: 0,
        inclusive: false,
      });

      // Mock currency
      jest.spyOn(currencyService, 'getBranchCurrency').mockResolvedValue('UGX');

      // Mock rounding
      jest.spyOn(taxService, 'applyRounding').mockImplementation((_, amount) => amount);

      const result = await service.calculateOrderTotals({
        orgId: 'org-1',
        branchId: 'branch-1',
        items: [
          { itemId: 'food-1', price: 5900, quantity: 1 }, // 18% VAT
          { itemId: 'alcohol-1', price: 5750, quantity: 1 }, // 15% Excise
        ],
      });

      // Verify items have correct tax rules
      expect(result.items[0].taxRule.rate).toBe(0.18);
      expect(result.items[1].taxRule.rate).toBe(0.15);

      // Verify subtotal aggregates correctly
      expect(result.subtotal.gross).toBe(11650); // 5900 + 5750
      expect(result.subtotal.net).toBeGreaterThan(0);
      expect(result.subtotal.tax).toBeGreaterThan(0);
    });
  });

  describe('calculateEventBookingTotals', () => {
    it('should calculate event deposit with tax-inclusive pricing', async () => {
      // Mock tax matrix
      jest.spyOn(taxService, 'getTaxMatrix').mockResolvedValue({
        events: {
          code: 'VAT_STD',
          rate: 0.18,
          inclusive: true,
        },
        defaultTax: {
          code: 'VAT_STD',
          rate: 0.18,
          inclusive: true,
        },
      });

      // Mock tax calculation
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount / 1.18;
        const tax = amount - net;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: amount,
        };
      });

      const result = await service.calculateEventBookingTotals({
        orgId: 'org-1',
        deposit: 50000, // 50,000 UGX gross
      });

      // Deposit: 50,000 gross = 42,372.88 net + 7,627.12 tax
      expect(result.deposit).toBe(50000);
      expect(result.grossAmount).toBe(50000);
      expect(result.netAmount).toBe(42372.88);
      expect(result.taxAmount).toBe(7627.12);
      expect(result.taxRate).toBe(0.18);
      expect(result.taxInclusive).toBe(true);
    });

    it('should calculate event deposit with tax-exclusive pricing', async () => {
      // Mock tax matrix
      jest.spyOn(taxService, 'getTaxMatrix').mockResolvedValue({
        events: {
          code: 'VAT_STD',
          rate: 0.18,
          inclusive: false,
        },
      });

      // Mock tax calculation
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount;
        const tax = amount * 0.18;
        const gross = net + tax;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: Math.round(gross * 100) / 100,
        };
      });

      const result = await service.calculateEventBookingTotals({
        orgId: 'org-1',
        deposit: 50000, // 50,000 UGX net
      });

      // Deposit: 50,000 net + 9,000 tax = 59,000 gross
      expect(result.deposit).toBe(50000);
      expect(result.netAmount).toBe(50000);
      expect(result.taxAmount).toBe(9000);
      expect(result.grossAmount).toBe(59000);
      expect(result.taxRate).toBe(0.18);
      expect(result.taxInclusive).toBe(false);
    });

    it('should use defaultTax if events tax not defined', async () => {
      // Mock tax matrix (no events tax)
      jest.spyOn(taxService, 'getTaxMatrix').mockResolvedValue({
        defaultTax: {
          code: 'VAT_STD',
          rate: 0.18,
          inclusive: true,
        },
      });

      // Mock tax calculation
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount / 1.18;
        const tax = amount - net;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: amount,
        };
      });

      const result = await service.calculateEventBookingTotals({
        orgId: 'org-1',
        deposit: 11800,
      });

      expect(result.netAmount).toBe(10000);
      expect(result.taxAmount).toBe(1800);
      expect(result.taxRate).toBe(0.18);
    });
  });

  describe('calculateItemTax', () => {
    it('should calculate single item tax', async () => {
      // Mock tax rule
      jest.spyOn(taxService, 'resolveLineTax').mockResolvedValue({
        code: 'VAT_STD',
        rate: 0.18,
        inclusive: true,
      });

      // Mock tax calculation
      jest.spyOn(taxService, 'calculateTax').mockImplementation((amount) => {
        const net = amount / 1.18;
        const tax = amount - net;
        return {
          net: Math.round(net * 100) / 100,
          taxAmount: Math.round(tax * 100) / 100,
          gross: amount,
        };
      });

      const result = await service.calculateItemTax({
        orgId: 'org-1',
        itemId: 'item-1',
        price: 11800,
        quantity: 2,
      });

      // 2 x 11,800 = 23,600 gross = 20,000 net + 3,600 tax
      expect(result.net).toBe(20000);
      expect(result.tax).toBe(3600);
      expect(result.gross).toBe(23600);
      expect(result.taxRule.rate).toBe(0.18);
    });
  });
});
