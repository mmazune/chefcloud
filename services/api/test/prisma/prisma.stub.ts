import { OnModuleInit, OnModuleDestroy } from '@nestjs/common';

/* Minimal PrismaService stub for billing slice tests. Extend as endpoints need. */
export class PrismaStub implements OnModuleInit, OnModuleDestroy {
  // Implement lifecycle hooks (no-op for tests)
  async onModuleInit() {
    // Don't call $connect in tests
  }

  async onModuleDestroy() {
    // Don't call $disconnect in tests
  }

  // Stub Prisma connection methods (prevent actual DB connections)
  $connect = jest.fn().mockResolvedValue(undefined);
  $disconnect = jest.fn().mockResolvedValue(undefined);
  $use = jest.fn();
  
  // Billing-related models
  subscriptionPlan = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'free', name: 'Free', priceUsd: 0, code: 'FREE' },
      { id: 'pro', name: 'Pro', priceUsd: 49.99, code: 'PRO' },
      { id: 'enterprise', name: 'Enterprise', priceUsd: 199.99, code: 'ENTERPRISE' },
    ]),
    findUnique: jest.fn((args) => {
      const plans = [
        { id: 'free', name: 'Free', priceUsd: 0, code: 'FREE' },
        { id: 'pro', name: 'Pro', priceUsd: 49.99, code: 'PRO' },
      ];
      return Promise.resolve(plans.find((p) => p.id === args.where?.id || p.code === args.where?.code));
    }),
  };

  orgSubscription = {
    findFirst: jest.fn().mockResolvedValue({
      id: 'sub_1',
      orgId: 'org_1',
      planCode: 'FREE',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
    }),
    findMany: jest.fn().mockResolvedValue([
      {
        id: 'sub_1',
        orgId: 'org_1',
        planCode: 'FREE',
        status: 'ACTIVE',
        startDate: new Date('2024-01-01'),
      },
    ]),
  };

  subscriptionEvent = {
    create: jest.fn((args) => Promise.resolve({ id: 'evt_1', ...args.data })),
    deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
  };

  // Purchasing-related models
  purchaseOrder = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'po_001', supplierId: 'sup_1', status: 'OPEN', totalCost: 12345, branchId: 'branch_1', createdAt: new Date('2024-01-15') },
      { id: 'po_002', supplierId: 'sup_2', status: 'APPROVED', totalCost: 9876, branchId: 'branch_1', createdAt: new Date('2024-01-16') },
    ]),
    findUnique: jest.fn((args) => {
      const orders = {
        po_001: {
          id: 'po_001',
          supplierId: 'sup_1',
          status: 'OPEN',
          totalCost: 12345,
          branchId: 'branch_1',
          createdAt: new Date('2024-01-15'),
          items: [{ id: 'poi_1', sku: 'ITEM-1', quantity: 5, unitCost: 1000 }],
        },
        po_002: {
          id: 'po_002',
          supplierId: 'sup_2',
          status: 'APPROVED',
          totalCost: 9876,
          branchId: 'branch_1',
          createdAt: new Date('2024-01-16'),
          items: [],
        },
      };
      return Promise.resolve(orders[args.where?.id] || null);
    }),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'po_new',
        supplierId: args.data.supplierId || 'sup_1',
        status: 'OPEN',
        totalCost: 0,
        branchId: args.data.branchId || 'branch_1',
        createdAt: new Date(),
      })
    ),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id,
        supplierId: 'sup_1',
        status: args.data.status || 'APPROVED',
        totalCost: 12345,
        branchId: 'branch_1',
        createdAt: new Date('2024-01-15'),
      })
    ),
  };

  supplier = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'sup_1', name: 'Acme Foods', email: 'orders@acmefoods.com', status: 'ACTIVE' },
      { id: 'sup_2', name: 'FreshCo', email: 'supply@freshco.com', status: 'ACTIVE' },
    ]),
    findUnique: jest.fn((args) => {
      const suppliers = {
        sup_1: { id: 'sup_1', name: 'Acme Foods', email: 'orders@acmefoods.com', status: 'ACTIVE' },
        sup_2: { id: 'sup_2', name: 'FreshCo', email: 'supply@freshco.com', status: 'ACTIVE' },
      };
      return Promise.resolve(suppliers[args.where?.id] || null);
    }),
  };

  // Generic fallback if service references prisma.<model> directly
  [key: string]: any;
}
