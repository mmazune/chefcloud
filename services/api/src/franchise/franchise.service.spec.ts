/* eslint-disable @typescript-eslint/no-explicit-any */
import { Test } from '@nestjs/testing';
import { FranchiseService } from './franchise.service';
import { PrismaService } from '../prisma.service';

describe('FranchiseService', () => {
  let service: FranchiseService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [
        FranchiseService,
        {
          provide: PrismaService,
          useValue: {
            franchiseRank: {
              findMany: jest.fn(),
            },
            orgSettings: {
              findUnique: jest.fn(),
            },
            branch: {
              findMany: jest.fn(),
            },
            order: {
              findMany: jest.fn(),
            },
            wastage: {
              findMany: jest.fn(),
            },
            branchBudget: {
              upsert: jest.fn(),
              findMany: jest.fn(),
            },
            forecastPoint: {
              findMany: jest.fn(),
            },
            inventoryItem: {
              findMany: jest.fn(),
            },
            client: {
              stockBatch: {
                aggregate: jest.fn(),
              },
              procurementJob: {
                create: jest.fn(),
              },
              purchaseOrder: {
                create: jest.fn(),
                findMany: jest.fn(),
                updateMany: jest.fn(),
              },
              supplier: {
                findUnique: jest.fn(),
              },
            },
          },
        },
      ],
    }).compile();

    service = module.get<FranchiseService>(FranchiseService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('getRankings', () => {
    it('should use default weights if franchiseWeights not set', async () => {
      const orgId = 'org-123';
      const period = '2025-10';

      // Mock no existing ranks
      jest.spyOn(prisma.franchiseRank, 'findMany').mockResolvedValue([]);

      // Mock org settings with no custom weights
      jest.spyOn(prisma.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-1',
        orgId,
        franchiseWeights: null,
      } as any);

      // Mock branches
      jest.spyOn(prisma.branch, 'findMany').mockResolvedValue([
        { id: 'branch-1', name: 'Branch A' },
        { id: 'branch-2', name: 'Branch B' },
      ] as any);

      // Mock orders
      jest
        .spyOn(prisma.order, 'findMany')
        .mockResolvedValueOnce([
          { total: 100000 },
          { total: 50000 },
        ] as any) // Branch A
        .mockResolvedValueOnce([{ total: 80000 }] as any); // Branch B

      // Mock wastage
      jest
        .spyOn(prisma.wastage, 'findMany')
        .mockResolvedValueOnce([{ qty: 2 }] as any) // Branch A
        .mockResolvedValueOnce([{ qty: 5 }] as any); // Branch B

      const rankings = await service.getRankings(orgId, period);

      expect(rankings).toHaveLength(2);
      expect(rankings[0].rank).toBe(1);
      expect(rankings[1].rank).toBe(2);

      // Branch A should rank higher (more revenue)
      expect(rankings[0].branchId).toBe('branch-1');
    });

    it('should use custom weights from org settings', async () => {
      const orgId = 'org-123';
      const period = '2025-10';

      // Mock no existing ranks
      jest.spyOn(prisma.franchiseRank, 'findMany').mockResolvedValue([]);

      // Mock org settings with custom weights (waste heavily weighted)
      jest.spyOn(prisma.orgSettings, 'findUnique').mockResolvedValue({
        id: 'settings-1',
        orgId,
        franchiseWeights: {
          revenue: 0.2,
          margin: 0.2,
          waste: -0.5, // Heavy waste penalty
          sla: 0.1,
        },
      } as any);

      // Mock branches
      jest.spyOn(prisma.branch, 'findMany').mockResolvedValue([
        { id: 'branch-1', name: 'Branch A' },
        { id: 'branch-2', name: 'Branch B' },
      ] as any);

      // Mock orders (Branch B has more revenue)
      jest
        .spyOn(prisma.order, 'findMany')
        .mockResolvedValueOnce([{ total: 80000 }] as any) // Branch A
        .mockResolvedValueOnce([{ total: 100000 }] as any); // Branch B

      // Mock wastage (Branch A has less waste)
      jest
        .spyOn(prisma.wastage, 'findMany')
        .mockResolvedValueOnce([{ qty: 1 }] as any) // Branch A - low waste
        .mockResolvedValueOnce([{ qty: 10 }] as any); // Branch B - high waste

      const rankings = await service.getRankings(orgId, period);

      expect(rankings).toHaveLength(2);

      // With heavy waste penalty, Branch A should rank higher despite lower revenue
      expect(rankings[0].branchId).toBe('branch-1');
      expect(rankings[0].rank).toBe(1);
    });
  });

  describe('calculateMovingAverage', () => {
    it('should calculate MA14 correctly', async () => {
      const branchId = 'branch-1';
      const itemId = 'item-1';

      // Mock stock batches consumed over 14 days
      jest.spyOn(prisma.client.stockBatch, 'aggregate').mockResolvedValue({
        _sum: {
          receivedQty: 140, // Received 140 units
          remainingQty: 70, // 70 units remaining
        },
      } as any);

      const avg = await service.calculateMovingAverage('org-1', branchId, itemId, 14);

      // (140 - 70) / 14 = 5 units per day
      expect(avg).toBe(5);
    });

    it('should return 0 for no consumption', async () => {
      const branchId = 'branch-1';
      const itemId = 'item-1';

      jest.spyOn(prisma.client.stockBatch, 'aggregate').mockResolvedValue({
        _sum: {
          receivedQty: 0,
          remainingQty: 0,
        },
      } as any);

      const avg = await service.calculateMovingAverage('org-1', branchId, itemId, 14);

      expect(avg).toBe(0);
    });
  });

  describe('upsertBudget', () => {
    it('should create new budget if not exists', async () => {
      const orgId = 'org-1';
      const branchId = 'branch-1';
      const period = '2025-11';

      const mockBudget = {
        id: 'budget-1',
        orgId,
        branchId,
        period,
        revenueTarget: 500000,
        cogsTarget: 200000,
        expenseTarget: 100000,
        notes: 'Q4 target',
      };

      jest.spyOn(prisma.branchBudget, 'upsert').mockResolvedValue(mockBudget as any);

      const result = await service.upsertBudget(orgId, branchId, period, {
        revenueTarget: 500000,
        cogsTarget: 200000,
        expenseTarget: 100000,
        notes: 'Q4 target',
      });

      expect(result).toEqual({
        id: 'budget-1',
        branchId,
        period,
        revenueTarget: 500000,
        cogsTarget: 200000,
        expenseTarget: 100000,
        notes: 'Q4 target',
      });
    });
  });

  describe('getProcurementSuggestions', () => {
    it('should suggest items below safety stock', async () => {
      jest.spyOn(prisma.inventoryItem, 'findMany').mockResolvedValue([
        {
          id: 'item-1',
          name: 'Rice',
          reorderLevel: 100,
          reorderQty: 200,
          stockBatches: [
            { remainingQty: 30 }, // Current stock: 30
          ],
        },
        {
          id: 'item-2',
          name: 'Beans',
          reorderLevel: 50,
          reorderQty: 100,
          stockBatches: [
            { remainingQty: 60 }, // Current stock: 60 (above reorder level)
          ],
        },
      ] as any);

      const suggestions = await service.getProcurementSuggestions('org-1');

      expect(suggestions).toHaveLength(1);
      expect(suggestions[0].itemName).toBe('Rice');
      expect(suggestions[0].currentStock).toBe(30);
      expect(suggestions[0].safetyStock).toBe(100);
      expect(suggestions[0].suggestedQty).toBe(200);
    });
  });

  describe('E22-s3: Central Procurement', () => {
    describe('generateDraftPOs', () => {
      it('should apply packSize rounding correctly', async () => {
        const orgId = 'org-1';
        const userId = 'user-1';

        // Mock branches
        jest.spyOn(prisma.branch, 'findMany').mockResolvedValue([
          { id: 'branch-1', name: 'Branch A' },
        ] as any);

        // Mock inventory items below safety stock
        jest.spyOn(prisma.inventoryItem, 'findMany').mockResolvedValue([
          {
            id: 'item-1',
            reorderLevel: 100,
            reorderQty: 50,
            metadata: { supplierId: 'supplier-1' },
            stockBatches: [{ remainingQty: 30 }], // Below safety stock
          },
        ] as any);

        // Mock supplier with packSize = 10
        jest.spyOn(prisma.client.supplier, 'findUnique').mockResolvedValue({
          id: 'supplier-1',
          packSize: 10,
          minOrderQty: null,
        } as any);

        // Mock procurement job creation
        const mockJob = { id: 'job-1', draftPoCount: 1 };
        jest.spyOn(prisma.client.procurementJob, 'create').mockResolvedValue(mockJob as any);

        // Mock PO creation
        const mockPO = { id: 'po-1' };
        jest.spyOn(prisma.client.purchaseOrder, 'create').mockResolvedValue(mockPO as any);

        const result = await service.generateDraftPOs(orgId, userId, 'SAFETY_STOCK');

        expect(result.jobId).toBe('job-1');
        expect(result.drafts).toHaveLength(1);

        // Check PO creation was called with rounded qty
        const poCreateCall = (prisma.client.purchaseOrder.create as jest.Mock).mock.calls[0][0];
        const items = poCreateCall.data.items.create;

        // suggestedQty = 50, packSize = 10 -> rounds to 50 (already multiple of 10)
        expect(items[0].qty).toBe(50);
      });

      it('should enforce minOrderQty', async () => {
        const orgId = 'org-1';
        const userId = 'user-1';

        jest.spyOn(prisma.branch, 'findMany').mockResolvedValue([
          { id: 'branch-1', name: 'Branch A' },
        ] as any);

        jest.spyOn(prisma.inventoryItem, 'findMany').mockResolvedValue([
          {
            id: 'item-1',
            reorderLevel: 100,
            reorderQty: 15, // Small reorder qty
            metadata: { supplierId: 'supplier-1' },
            stockBatches: [{ remainingQty: 30 }],
          },
        ] as any);

        // Mock supplier with minOrderQty = 50
        jest.spyOn(prisma.client.supplier, 'findUnique').mockResolvedValue({
          id: 'supplier-1',
          packSize: null,
          minOrderQty: 50,
        } as any);

        const mockJob = { id: 'job-1', draftPoCount: 1 };
        jest.spyOn(prisma.client.procurementJob, 'create').mockResolvedValue(mockJob as any);

        const mockPO = { id: 'po-1' };
        jest.spyOn(prisma.client.purchaseOrder, 'create').mockResolvedValue(mockPO as any);

        await service.generateDraftPOs(orgId, userId, 'SAFETY_STOCK');

        const poCreateCall = (prisma.client.purchaseOrder.create as jest.Mock).mock.calls[0][0];
        const items = poCreateCall.data.items.create;

        // suggestedQty = 15, but minOrderQty = 50 -> enforced to 50
        expect(items[0].qty).toBe(50);
      });

      it('should group items by supplier and branch', async () => {
        const orgId = 'org-1';
        const userId = 'user-1';

        jest.spyOn(prisma.branch, 'findMany').mockResolvedValue([
          { id: 'branch-1', name: 'Branch A' },
        ] as any);

        jest.spyOn(prisma.inventoryItem, 'findMany').mockResolvedValue([
          {
            id: 'item-1',
            reorderLevel: 100,
            reorderQty: 50,
            metadata: { supplierId: 'supplier-1' },
            stockBatches: [{ remainingQty: 30 }],
          },
          {
            id: 'item-2',
            reorderLevel: 80,
            reorderQty: 40,
            metadata: { supplierId: 'supplier-1' }, // Same supplier
            stockBatches: [{ remainingQty: 20 }],
          },
          {
            id: 'item-3',
            reorderLevel: 60,
            reorderQty: 30,
            metadata: { supplierId: 'supplier-2' }, // Different supplier
            stockBatches: [{ remainingQty: 10 }],
          },
        ] as any);

        jest.spyOn(prisma.client.supplier, 'findUnique').mockResolvedValue({
          packSize: null,
          minOrderQty: null,
        } as any);

        const mockJob = { id: 'job-1', draftPoCount: 2 }; // 2 suppliers = 2 POs
        jest.spyOn(prisma.client.procurementJob, 'create').mockResolvedValue(mockJob as any);

        const mockPO = { id: 'po-1' };
        jest.spyOn(prisma.client.purchaseOrder, 'create').mockResolvedValue(mockPO as any);

        const result = await service.generateDraftPOs(orgId, userId, 'SAFETY_STOCK');

        // Should create 2 POs (one per supplier)
        expect(prisma.client.purchaseOrder.create).toHaveBeenCalledTimes(2);
        expect(result.drafts).toHaveLength(2);
      });
    });

    describe('getDraftPOs', () => {
      it('should return draft POs with supplier and branch details', async () => {
        const orgId = 'org-1';

        jest.spyOn(prisma.client.purchaseOrder, 'findMany').mockResolvedValue([
          {
            id: 'po-1',
            supplierId: 'supplier-1',
            branchId: 'branch-1',
            totalAmount: 100000,
            supplier: { id: 'supplier-1', name: 'Supplier A' },
            branch: { id: 'branch-1', name: 'Branch A' },
            items: [{ id: 'item-1' }, { id: 'item-2' }],
          },
        ] as any);

        const drafts = await service.getDraftPOs(orgId);

        expect(drafts).toHaveLength(1);
        expect(drafts[0].poId).toBe('po-1');
        expect(drafts[0].supplierName).toBe('Supplier A');
        expect(drafts[0].branchName).toBe('Branch A');
        expect(drafts[0].itemsCount).toBe(2);
        expect(drafts[0].total).toBe(100000);
      });
    });

    describe('approvePOs', () => {
      it('should update PO status to PLACED and log email stubs', async () => {
        const orgId = 'org-1';
        const poIds = ['po-1', 'po-2'];

        const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();

        jest.spyOn(prisma.client.purchaseOrder, 'findMany').mockResolvedValue([
          {
            id: 'po-1',
            poNumber: 'PO-001',
            supplier: { id: 'supplier-1', name: 'Supplier A', email: 'supplier-a@example.com' },
            items: [{ id: 'item-1' }, { id: 'item-2' }],
          },
          {
            id: 'po-2',
            poNumber: 'PO-002',
            supplier: { id: 'supplier-2', name: 'Supplier B', email: 'supplier-b@example.com' },
            items: [{ id: 'item-3' }],
          },
        ] as any);

        jest.spyOn(prisma.client.purchaseOrder, 'updateMany').mockResolvedValue({ count: 2 } as any);

        await service.approvePOs(orgId, poIds);

        // Check that status update was called
        expect(prisma.client.purchaseOrder.updateMany).toHaveBeenCalledWith({
          where: { id: { in: poIds }, orgId, status: 'DRAFT' },
          data: { status: 'PLACED' },
        });

        // Check that email stubs were logged
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('[EMAIL STUB]'),
        );
        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining('supplier-a@example.com'),
        );

        consoleLogSpy.mockRestore();
      });
    });
  });
});
