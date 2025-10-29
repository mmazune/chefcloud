/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing';
import { PromotionsService } from './promotions.service';
import { PrismaService } from '../prisma.service';

describe('PromotionsService', () => {
  let service: PromotionsService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        PromotionsService,
        {
          provide: PrismaService,
          useValue: {
            client: {
              promotion: {
                create: jest.fn(),
                findMany: jest.fn(),
                findUnique: jest.fn(),
                update: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<PromotionsService>(PromotionsService);
  }

);
  describe('evaluatePromotion', () => {
    it('should match time window', async () => {
      const promotion = {
        active: true,
        startsAt: new Date('2025-10-29T00:00:00Z'),
        endsAt: new Date('2025-10-31T23:59:59Z'),
        scope: {},
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date('2025-10-30T12:00:00Z'), // Within window
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should reject expired promotion', async () => {
      const promotion = {
        active: true,
        startsAt: new Date('2025-10-01T00:00:00Z'),
        endsAt: new Date('2025-10-15T23:59:59Z'),
        scope: {},
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date('2025-10-30T12:00:00Z'), // After window
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });

    it('should match daypart (day of week)', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {
          days: [1, 2, 3, 4, 5], // Monday-Friday
        },
        code: null,
      };

      // Friday 12:00 PM
      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date('2025-10-31T12:00:00Z'), // Friday
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should reject wrong day of week', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {
          days: [1, 2, 3, 4, 5], // Monday-Friday
        },
        code: null,
      };

      // Sunday
      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date('2025-11-02T12:00:00Z'), // Sunday
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });

    it('should match time range (happy hour)', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {
          start: '17:00',
          end: '19:00',
        },
        code: null,
      };

      // Set time to 18:00 UTC
      const date = new Date('2025-10-30T18:00:00Z');
      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: date,
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should reject outside time range', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {
          start: '17:00',
          end: '19:00',
        },
        code: null,
      };

      // Set time to 20:00 UTC
      const date = new Date('2025-10-30T20:00:00Z');
      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: date,
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });

    it('should match branch scope', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {
          branches: ['branch-1', 'branch-2'],
        },
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date(),
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should reject wrong branch', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {
          branches: ['branch-1', 'branch-2'],
        },
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-3',
        items: [],
        timestamp: new Date(),
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });

    it('should match item scope', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {
          items: ['item-1', 'item-2'],
        },
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [{ menuItemId: 'item-1', category: 'drinks' }],
        timestamp: new Date(),
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should match category scope', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {
          categories: ['drinks', 'appetizers'],
        },
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [{ menuItemId: 'item-1', category: 'drinks' }],
        timestamp: new Date(),
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should reject wrong category', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {
          categories: ['drinks', 'appetizers'],
        },
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [{ menuItemId: 'item-1', category: 'entrees' }],
        timestamp: new Date(),
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });

    it('should require coupon code', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {},
        code: 'SAVE20',
      };

      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date(),
        couponCode: 'SAVE20',
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(true);
    });

    it('should reject wrong coupon code', async () => {
      const promotion = {
        active: true,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {},
        code: 'SAVE20',
      };

      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date(),
        couponCode: 'WRONGCODE',
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });

    it('should reject inactive promotion', async () => {
      const promotion = {
        active: false,
        startsAt: null,
        endsAt: null,
        scope: {},
        daypart: {},
        code: null,
      };

      const context = {
        branchId: 'branch-1',
        items: [],
        timestamp: new Date(),
      };

      const result = await service.evaluatePromotion(promotion, context);
      expect(result).toBe(false);
    });
  });
});
