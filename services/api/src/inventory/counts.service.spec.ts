/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test, TestingModule } from '@nestjs/testing';
import { ConflictException, NotFoundException } from '@nestjs/common';
import { CountsService } from './counts.service';
import { PrismaService } from '../prisma.service';
import { InventoryService } from './inventory.service';

describe('CountsService', () => {
  let service: CountsService;

  const mockPrisma = {
    client: {
      shift: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
      },
      stockCount: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      orgSettings: {
        findUnique: jest.fn(),
      },
      inventoryItem: {
        findUnique: jest.fn(),
      },
      auditEvent: {
        create: jest.fn(),
      },
      anomalyEvent: {
        create: jest.fn(),
      },
    },
  };

  const mockInventory = {
    getOnHandLevels: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CountsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: InventoryService, useValue: mockInventory },
      ],
    }).compile();

    service = module.get<CountsService>(CountsService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('beginCount', () => {
    it('should create a new stock count for open shift', async () => {
      const shift = { id: 'shift-1', branchId: 'branch-1', closedAt: null };
      mockPrisma.client.shift.findFirst.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(null);
      mockPrisma.client.stockCount.create.mockResolvedValue({
        id: 'count-1',
        shiftId: 'shift-1',
        lines: [],
      });

      const result = await service.beginCount('org-1', 'branch-1', 'user-1');

      expect(result.id).toBe('count-1');
      expect(mockPrisma.client.stockCount.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          branchId: 'branch-1',
          shiftId: 'shift-1',
          countedById: 'user-1',
          notes: undefined,
          lines: [],
        },
      });
    });

    it('should return existing draft if already started', async () => {
      const shift = { id: 'shift-1', branchId: 'branch-1', closedAt: null };
      const existing = { id: 'count-1', shiftId: 'shift-1', lines: [] };
      mockPrisma.client.shift.findFirst.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(existing);

      const result = await service.beginCount('org-1', 'branch-1', 'user-1');

      expect(result.id).toBe('count-1');
      expect(mockPrisma.client.stockCount.create).not.toHaveBeenCalled();
    });

    it('should throw if no open shift', async () => {
      mockPrisma.client.shift.findFirst.mockResolvedValue(null);

      await expect(service.beginCount('org-1', 'branch-1', 'user-1')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('submitCount', () => {
    it('should finalize stock count with lines', async () => {
      const count = { id: 'count-1', shiftId: 'shift-1', notes: null };
      const lines = [
        { itemId: 'item-1', countedQty: 10 },
        { itemId: 'item-2', countedQty: 5 },
      ];

      mockPrisma.client.stockCount.findUnique.mockResolvedValue(count);
      mockPrisma.client.stockCount.update.mockResolvedValue({
        ...count,
        lines,
        countedAt: new Date(),
      });

      const result = await service.submitCount('count-1', lines);

      expect(result.lines).toEqual(lines);
      expect(mockPrisma.client.stockCount.update).toHaveBeenCalledWith({
        where: { id: 'count-1' },
        data: {
          lines,
          notes: null,
          countedAt: expect.any(Date),
        },
      });
    });
  });

  describe('validateShiftStockCount - tolerance logic', () => {
    it('should pass when variances are within percentage tolerance', async () => {
      const shift = { id: 'shift-1', orgId: 'org-1', branchId: 'branch-1' };
      const count = {
        id: 'count-1',
        shiftId: 'shift-1',
        lines: [
          { itemId: 'item-1', countedQty: 105 }, // Expected 100, variance 5%
        ],
      };
      const settings = { inventoryTolerance: { pct: 0.05, absolute: 0 } };

      mockPrisma.client.shift.findUnique.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(count);
      mockPrisma.client.orgSettings.findUnique.mockResolvedValue(settings);
      mockInventory.getOnHandLevels.mockResolvedValue({ 'item-1': 100 });
      mockPrisma.client.inventoryItem.findUnique.mockResolvedValue({
        name: 'Item 1',
      });

      const result = await service.validateShiftStockCount('shift-1');

      expect(result.status).toBe('OK');
      expect(result.variances).toHaveLength(1);
      expect(result.variances[0].variance).toBe(5);
    });

    it('should pass when variance within absolute tolerance', async () => {
      const shift = { id: 'shift-1', orgId: 'org-1', branchId: 'branch-1' };
      const count = {
        id: 'count-1',
        shiftId: 'shift-1',
        lines: [{ itemId: 'item-1', countedQty: 3 }], // Expected 1, variance 200% but only 2 units
      };
      const settings = { inventoryTolerance: { pct: 0.05, absolute: 2 } };

      mockPrisma.client.shift.findUnique.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(count);
      mockPrisma.client.orgSettings.findUnique.mockResolvedValue(settings);
      mockInventory.getOnHandLevels.mockResolvedValue({ 'item-1': 1 });
      mockPrisma.client.inventoryItem.findUnique.mockResolvedValue({
        name: 'Item 1',
      });

      const result = await service.validateShiftStockCount('shift-1');

      expect(result.status).toBe('OK');
    });

    it('should reject when variance exceeds both tolerances', async () => {
      const shift = { id: 'shift-1', orgId: 'org-1', branchId: 'branch-1' };
      const count = {
        id: 'count-1',
        shiftId: 'shift-1',
        lines: [{ itemId: 'item-1', countedQty: 150 }], // Expected 100, variance 50%
      };
      const settings = { inventoryTolerance: { pct: 0.05, absolute: 0 } };

      mockPrisma.client.shift.findUnique.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(count);
      mockPrisma.client.orgSettings.findUnique.mockResolvedValue(settings);
      mockInventory.getOnHandLevels.mockResolvedValue({ 'item-1': 100 });
      mockPrisma.client.inventoryItem.findUnique.mockResolvedValue({
        name: 'Item 1',
      });

      await expect(service.validateShiftStockCount('shift-1')).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.validateShiftStockCount('shift-1');
      } catch (e: any) {
        expect(e.response.code).toBe('COUNT_OUT_OF_TOLERANCE');
        expect(e.response.items).toHaveLength(1);
      }
    });

    it('should reject if no stock count exists', async () => {
      const shift = { id: 'shift-1', orgId: 'org-1', branchId: 'branch-1' };
      mockPrisma.client.shift.findUnique.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(null);

      await expect(service.validateShiftStockCount('shift-1')).rejects.toThrow(
        ConflictException,
      );

      try {
        await service.validateShiftStockCount('shift-1');
      } catch (e: any) {
        expect(e.response.code).toBe('COUNT_REQUIRED');
      }
    });

    it('should reject if count has no lines', async () => {
      const shift = { id: 'shift-1', orgId: 'org-1', branchId: 'branch-1' };
      const count = { id: 'count-1', shiftId: 'shift-1', lines: [] };
      mockPrisma.client.shift.findUnique.mockResolvedValue(shift);
      mockPrisma.client.stockCount.findFirst.mockResolvedValue(count);

      await expect(service.validateShiftStockCount('shift-1')).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('emitVarianceAnomalies', () => {
    it('should emit NEGATIVE_STOCK for negative variance', async () => {
      const variances = [
        {
          itemId: 'item-1',
          itemName: 'Item 1',
          expected: 10,
          counted: 5,
          variance: -5,
          variancePct: -0.5,
        },
      ];

      await service.emitVarianceAnomalies('org-1', 'branch-1', variances);

      expect(mockPrisma.client.anomalyEvent.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          branchId: 'branch-1',
          type: 'NEGATIVE_STOCK',
          severity: 'CRITICAL',
          details: expect.objectContaining({
            variance: -5,
          }),
        },
      });
    });

    it('should emit LARGE_VARIANCE for positive variance', async () => {
      const variances = [
        {
          itemId: 'item-1',
          itemName: 'Item 1',
          expected: 10,
          counted: 20,
          variance: 10,
          variancePct: 1.0,
        },
      ];

      await service.emitVarianceAnomalies('org-1', 'branch-1', variances);

      expect(mockPrisma.client.anomalyEvent.create).toHaveBeenCalledWith({
        data: {
          orgId: 'org-1',
          branchId: 'branch-1',
          type: 'LARGE_VARIANCE',
          severity: 'WARN',
          details: expect.objectContaining({
            variance: 10,
          }),
        },
      });
    });
  });
});
