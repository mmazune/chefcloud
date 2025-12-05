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
      { id: 'free', name: 'Free', priceUsd: 0, code: 'FREE', isActive: true },
      { id: 'pro', name: 'Pro', priceUsd: 49.99, code: 'PRO', isActive: true },
      { id: 'enterprise', name: 'Enterprise', priceUsd: 199.99, code: 'ENTERPRISE', isActive: true },
      { id: 'inactive_plan', name: 'Inactive', priceUsd: 0, code: 'INACTIVE', isActive: false },
    ]),
    findUnique: jest.fn((args) => {
      const plans = [
        { id: 'free', name: 'Free', priceUsd: 0, code: 'FREE', isActive: true },
        { id: 'pro', name: 'Pro', priceUsd: 49.99, code: 'PRO', isActive: true },
        { id: 'inactive_plan', name: 'Inactive', priceUsd: 0, code: 'INACTIVE', isActive: false },
      ];
      return Promise.resolve(plans.find((p) => p.id === args.where?.id || p.code === args.where?.code));
    }),
    upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => ({
      id: create?.code ?? update?.code ?? where?.code ?? 'plan_new',
      code: create?.code ?? update?.code ?? where?.code ?? 'NEW',
      name: update?.name ?? create?.name ?? 'New Plan',
      priceUGX: update?.priceUGX ?? create?.priceUGX ?? 0,
      features: update?.features ?? create?.features ?? {},
      isActive: update?.isActive ?? create?.isActive ?? true,
      updatedAt: new Date(),
    })),
  };

  orgSubscription = {
    findFirst: jest.fn().mockResolvedValue({
      id: 'sub_1',
      orgId: 'org_1',
      planId: 'free',
      planCode: 'FREE',
      status: 'ACTIVE',
      startDate: new Date('2024-01-01'),
      nextRenewalAt: new Date('2024-02-01'),
    }),
    findMany: jest.fn().mockImplementation(async ({ include }: any) => {
      const baseSubs = [
        {
          id: 'sub_1',
          orgId: 'org_1',
          planId: 'free',
          planCode: 'FREE',
          status: 'ACTIVE',
          startDate: new Date('2024-01-01'),
          nextRenewalAt: new Date('2024-02-01'),
        },
        {
          id: 'sub_2',
          orgId: 'org_2',
          planId: 'pro',
          planCode: 'PRO',
          status: 'ACTIVE',
          startDate: new Date('2024-01-15'),
          nextRenewalAt: new Date('2024-02-15'),
        },
      ];

      // Add includes if requested
      if (include?.org || include?.plan) {
        return baseSubs.map((sub) => ({
          ...sub,
          ...(include.org && {
            org: { id: sub.orgId, name: sub.orgId === 'org_1' ? 'Test Restaurant' : 'Another Org', slug: sub.orgId },
          }),
          ...(include.plan && {
            plan: { code: sub.planCode, name: sub.planCode === 'FREE' ? 'Free' : 'Pro' },
          }),
        }));
      }

      return baseSubs;
    }),
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'sub_new',
      orgId: data?.orgId ?? 'org_new',
      planId: data?.planId ?? 'free',
      planCode: data?.planCode ?? 'FREE',
      status: data?.status ?? 'ACTIVE',
      startDate: new Date(),
      nextRenewalAt: data?.nextRenewalAt ?? new Date(),
      createdAt: new Date(),
    })),
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

  // Inventory-related models
  inventoryItem = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'item_001', orgId: 'org_1', sku: 'TOMATO-KG', name: 'Tomatoes', uom: 'kg', category: 'PRODUCE', status: 'ACTIVE' },
      { id: 'item_002', orgId: 'org_1', sku: 'CHEESE-KG', name: 'Cheese', uom: 'kg', category: 'DAIRY', status: 'ACTIVE' },
      { id: 'item_003', orgId: 'org_1', sku: 'FLOUR-KG', name: 'Flour', uom: 'kg', category: 'DRY_GOODS', status: 'ACTIVE' },
    ]),
    findUnique: jest.fn((args) => {
      const items: Record<string, any> = {
        item_001: { id: 'item_001', orgId: 'org_1', sku: 'TOMATO-KG', name: 'Tomatoes', uom: 'kg', category: 'PRODUCE', status: 'ACTIVE' },
        item_002: { id: 'item_002', orgId: 'org_1', sku: 'CHEESE-KG', name: 'Cheese', uom: 'kg', category: 'DAIRY', status: 'ACTIVE' },
      };
      return Promise.resolve(items[args.where?.id] || null);
    }),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'item_new',
        orgId: args.data.orgId || 'org_1',
        sku: args.data.sku || 'NEW-SKU',
        name: args.data.name || 'New Item',
        uom: args.data.uom || 'ea',
        category: args.data.category || 'OTHER',
        status: 'ACTIVE',
      })
    ),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id,
        orgId: 'org_1',
        sku: 'UPDATED-SKU',
        name: 'Updated Item',
        uom: 'kg',
        category: 'OTHER',
        status: args.data.status || 'ACTIVE',
      })
    ),
  };

  stockBatch = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'batch_001', itemId: 'item_001', branchId: 'branch_1', onHand: 25.0, unitCost: 2.5 },
      { id: 'batch_002', itemId: 'item_002', branchId: 'branch_1', onHand: 12.0, unitCost: 8.0 },
    ]),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'batch_new',
        itemId: args.data.itemId,
        branchId: args.data.branchId,
        onHand: args.data.onHand || 0,
        unitCost: args.data.unitCost || 0,
      })
    ),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id,
        itemId: 'item_001',
        branchId: 'branch_1',
        onHand: args.data.onHand !== undefined ? args.data.onHand : 0,
        unitCost: 2.5,
      })
    ),
  };

  wastage = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'wst_001', itemId: 'item_002', branchId: 'branch_1', quantity: 1.0, reason: 'Spoiled', recordedAt: new Date('2024-01-20') },
      { id: 'wst_002', itemId: 'item_001', branchId: 'branch_1', quantity: 0.5, reason: 'Trim waste', recordedAt: new Date('2024-01-21') },
    ]),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'wst_new',
        itemId: args.data.itemId,
        branchId: args.data.branchId || 'branch_1',
        quantity: args.data.quantity || 0,
        reason: args.data.reason || 'Unknown',
        recordedAt: new Date(),
      })
    ),
  };

  stockCount = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'cnt_001', branchId: 'branch_1', status: 'IN_PROGRESS', startedAt: new Date('2024-01-22') },
      { id: 'cnt_002', branchId: 'branch_1', status: 'COMPLETED', startedAt: new Date('2024-01-15'), completedAt: new Date('2024-01-15') },
    ]),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'cnt_new',
        branchId: args.data.branchId || 'branch_1',
        status: 'IN_PROGRESS',
        startedAt: new Date(),
      })
    ),
  };

  // --- Orders (POS) ---
  order = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'ord_001', branchId: 'branch_1', tableId: 'table_1', userId: 'user_1', orderNumber: 'ORD-001', status: 'NEW', serviceType: 'DINE_IN', subtotal: 1200, tax: 0, discount: 0, total: 1200, createdAt: new Date('2024-01-25T10:30:00Z') },
      { id: 'ord_002', branchId: 'branch_1', tableId: 'table_2', userId: 'user_1', orderNumber: 'ORD-002', status: 'SUBMITTED', serviceType: 'DINE_IN', subtotal: 5400, tax: 0, discount: 200, total: 5200, createdAt: new Date('2024-01-25T11:00:00Z') },
    ]),
    findUnique: jest.fn((args) => {
      const orders: Record<string, any> = {
        ord_001: { id: 'ord_001', branchId: 'branch_1', tableId: 'table_1', userId: 'user_1', orderNumber: 'ORD-001', status: 'NEW', serviceType: 'DINE_IN', subtotal: 1200, tax: 0, discount: 0, total: 1200, createdAt: new Date('2024-01-25T10:30:00Z'), orderItems: [] },
        ord_002: { id: 'ord_002', branchId: 'branch_1', tableId: 'table_2', userId: 'user_1', orderNumber: 'ORD-002', status: 'SUBMITTED', serviceType: 'DINE_IN', subtotal: 5400, tax: 0, discount: 200, total: 5200, createdAt: new Date('2024-01-25T11:00:00Z'), orderItems: [] },
      };
      return Promise.resolve(orders[args.where?.id] || null);
    }),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'ord_new',
        branchId: args.data.branchId || 'branch_1',
        tableId: args.data.tableId || null,
        userId: args.data.userId || 'user_1',
        orderNumber: args.data.orderNumber || 'ORD-NEW',
        status: 'NEW',
        serviceType: args.data.serviceType || 'DINE_IN',
        subtotal: 0,
        tax: 0,
        discount: 0,
        total: 0,
        createdAt: new Date(),
        orderItems: [],
      })
    ),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id,
        branchId: 'branch_1',
        tableId: 'table_1',
        userId: 'user_1',
        orderNumber: 'ORD-001',
        status: args.data.status || 'NEW',
        serviceType: 'DINE_IN',
        subtotal: typeof args.data.subtotal === 'number' ? args.data.subtotal : 1200,
        tax: typeof args.data.tax === 'number' ? args.data.tax : 0,
        discount: typeof args.data.discount === 'number' ? args.data.discount : 0,
        total: typeof args.data.total === 'number' ? args.data.total : 1200,
        createdAt: new Date('2024-01-25T10:30:00Z'),
        orderItems: [],
      })
    ),
  };

  orderItem = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'oi_001', orderId: 'ord_001', menuItemId: 'menu_001', quantity: 2, price: 600, subtotal: 1200, notes: '', createdAt: new Date('2024-01-25T10:35:00Z') },
    ]),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'oi_new',
        orderId: args.data.orderId || 'ord_001',
        menuItemId: args.data.menuItemId || 'menu_001',
        quantity: args.data.quantity || 1,
        price: args.data.price || 0,
        subtotal: args.data.subtotal || 0,
        notes: args.data.notes || '',
        createdAt: new Date(),
      })
    ),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id || 'oi_001',
        orderId: 'ord_001',
        menuItemId: 'menu_001',
        quantity: args.data.quantity !== undefined ? args.data.quantity : 1,
        price: args.data.price !== undefined ? args.data.price : 600,
        subtotal: args.data.subtotal !== undefined ? args.data.subtotal : 600,
        notes: args.data.notes !== undefined ? args.data.notes : '',
        createdAt: new Date('2024-01-25T10:35:00Z'),
      })
    ),
    delete: jest.fn().mockResolvedValue({ id: 'oi_deleted', orderId: 'ord_001' }),
  };

  table = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'table_1', branchId: 'branch_1', label: 'Table 1', capacity: 4, status: 'OCCUPIED' },
      { id: 'table_2', branchId: 'branch_1', label: 'Table 2', capacity: 2, status: 'AVAILABLE' },
    ]),
    findUnique: jest.fn((args) => {
      const tables: Record<string, any> = {
        table_1: { id: 'table_1', branchId: 'branch_1', label: 'Table 1', capacity: 4, status: 'OCCUPIED' },
        table_2: { id: 'table_2', branchId: 'branch_1', label: 'Table 2', capacity: 2, status: 'AVAILABLE' },
      };
      return Promise.resolve(tables[args.where?.id] || null);
    }),
  };

  kdsTicket = {
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'tkt_new',
        orderId: args.data.orderId || 'ord_001',
        station: args.data.station || 'KITCHEN',
        status: 'QUEUED',
        createdAt: new Date(),
      })
    ),
    findMany: jest.fn().mockResolvedValue([
      { id: 'tkt-001', orderId: 'ord-001', station: 'GRILL', items: [{ name: 'Burger', qty: 2 }], status: 'NEW' },
      { id: 'tkt-002', orderId: 'ord-002', station: 'FRY', items: [{ name: 'Fries', qty: 1 }], status: 'NEW' },
    ]),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id === 'tkt-001') return { id: 'tkt-001', orderId: 'ord-001', station: 'GRILL', items: [{ name: 'Burger', qty: 2 }], status: 'NEW' };
      if (where?.id === 'tkt-002') return { id: 'tkt-002', orderId: 'ord-002', station: 'FRY', items: [{ name: 'Fries', qty: 1 }], status: 'NEW' };
      return null;
    }),
    update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
      id: where?.id ?? 'tkt-unknown',
      orderId: 'ord-001',
      station: 'GRILL',
      items: [{ name: 'Burger', qty: 2 }],
      status: data?.status ?? 'NEW',
    })),
  };

  kdsScreen = {
    upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => ({
      id: where?.id ?? 'scr-001',
      station: create?.station ?? update?.station ?? 'GRILL',
      lastSeenAt: new Date().toISOString(),
    })),
  };

  // --- Payments ---
  payment = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'pay_001', orderId: 'ord_001', amount: 5400, method: 'MOBILE_MONEY', status: 'completed', transactionId: 'txn_001', createdAt: new Date('2024-01-25T12:00:00Z') },
      { id: 'pay_002', orderId: 'ord_002', amount: 1200, method: 'CASH', status: 'pending', transactionId: null, createdAt: new Date('2024-01-25T12:15:00Z') },
    ]),
    findUnique: jest.fn((args) => {
      const payments: Record<string, any> = {
        pay_001: { id: 'pay_001', orderId: 'ord_001', amount: 5400, method: 'MOBILE_MONEY', status: 'completed', transactionId: 'txn_001', createdAt: new Date('2024-01-25T12:00:00Z') },
        pay_002: { id: 'pay_002', orderId: 'ord_002', amount: 1200, method: 'CASH', status: 'pending', transactionId: null, createdAt: new Date('2024-01-25T12:15:00Z') },
      };
      return Promise.resolve(payments[args.where?.id] || null);
    }),
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'pay_new',
        orderId: args.data.orderId || 'ord_001',
        amount: args.data.amount || 0,
        method: args.data.method || 'CASH',
        status: 'pending',
        transactionId: null,
        createdAt: new Date(),
      })
    ),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id || 'pay_001',
        orderId: 'ord_001',
        amount: 5400,
        method: 'MOBILE_MONEY',
        status: args.data.status || 'completed',
        transactionId: args.data.transactionId || 'txn_001',
        createdAt: new Date('2024-01-25T12:00:00Z'),
      })
    ),
  };

  refund = {
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'ref_new',
        paymentId: args.data.paymentId || 'pay_001',
        amount: args.data.amount || 100,
        status: 'completed',
        createdAt: new Date(),
      })
    ),
    findMany: jest.fn().mockResolvedValue([
      { id: 'ref_001', paymentId: 'pay_001', amount: 100, status: 'completed', createdAt: new Date('2024-01-25T13:00:00Z') },
    ]),
    findUnique: jest.fn((args) => {
      const refunds: Record<string, any> = {
        ref_001: { id: 'ref_001', paymentId: 'pay_001', amount: 100, status: 'completed', createdAt: new Date('2024-01-25T13:00:00Z') },
      };
      return Promise.resolve(refunds[args.where?.id] || null);
    }),
  };

  paymentIntent = {
    create: jest.fn((args) =>
      Promise.resolve({
        id: 'pi_new',
        orgId: args.data.orgId || 'org_1',
        branchId: args.data.branchId || 'branch_1',
        amount: args.data.amount || 0,
        currency: args.data.currency || 'UGX',
        status: 'requires_capture',
        createdAt: new Date(),
      })
    ),
    findUnique: jest.fn((args) => {
      const intents: Record<string, any> = {
        pi_001: { id: 'pi_001', orgId: 'org_1', branchId: 'branch_1', amount: 2000, currency: 'UGX', status: 'requires_capture', createdAt: new Date('2024-01-25T11:00:00Z') },
      };
      return Promise.resolve(intents[args.where?.id] || null);
    }),
    update: jest.fn((args) =>
      Promise.resolve({
        id: args.where.id || 'pi_001',
        orgId: 'org_1',
        branchId: 'branch_1',
        amount: 2000,
        currency: 'UGX',
        status: args.data.status || 'cancelled',
        createdAt: new Date('2024-01-25T11:00:00Z'),
      })
    ),
  };

  // --- Reservations ---
  reservation = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'res-001', orgId: 'org_1', branchId: 'branch_1', tableId: 'T1', name: 'Alice', phone: '0700-000001', partySize: 2, reservationTime: '2025-11-13T18:00:00Z', status: 'PENDING', createdAt: new Date() },
      { id: 'res-002', orgId: 'org_1', branchId: 'branch_1', tableId: 'T2', name: 'Bob', phone: '0700-000002', partySize: 4, reservationTime: '2025-11-13T19:00:00Z', status: 'CONFIRMED', createdAt: new Date() },
    ]),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id === 'res-001') return { id: 'res-001', orgId: 'org_1', branchId: 'branch_1', tableId: 'T1', name: 'Alice', phone: '0700-000001', partySize: 2, reservationTime: '2025-11-13T18:00:00Z', status: 'PENDING', createdAt: new Date() };
      if (where?.id === 'res-002') return { id: 'res-002', orgId: 'org_1', branchId: 'branch_1', tableId: 'T2', name: 'Bob', phone: '0700-000002', partySize: 4, reservationTime: '2025-11-13T19:00:00Z', status: 'CONFIRMED', createdAt: new Date() };
      return null;
    }),
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'res-new',
      orgId: data?.orgId ?? 'org_1',
      branchId: data?.branchId ?? 'branch_1',
      tableId: data?.tableId ?? 'T1',
      name: data?.name ?? 'Guest',
      phone: data?.phone ?? '0700-000000',
      partySize: data?.partySize ?? 2,
      reservationTime: data?.reservationTime ?? '2025-11-13T18:00:00Z',
      status: 'PENDING',
      createdAt: new Date(),
    })),
    update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
      id: where?.id ?? 'res-unknown',
      orgId: 'org_1',
      branchId: 'branch_1',
      tableId: data?.tableId ?? 'T1',
      name: data?.name ?? 'Guest',
      phone: data?.phone ?? '0700-000000',
      partySize: data?.partySize ?? 2,
      reservationTime: data?.reservationTime ?? '2025-11-13T18:00:00Z',
      status: data?.status ?? 'CONFIRMED',
      createdAt: new Date(),
    })),
    count: jest.fn().mockResolvedValue(2),
  };

  reservationDeposit = {
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'dep-new',
      reservationId: data?.reservationId ?? 'res-001',
      amount: data?.amount ?? 5000,
      status: 'HELD',
      createdAt: new Date(),
    })),
    update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
      id: where?.id ?? 'dep-unknown',
      reservationId: data?.reservationId ?? 'res-001',
      amount: data?.amount ?? 5000,
      status: data?.status ?? 'REFUNDED',
      updatedAt: new Date(),
    })),
    findMany: jest.fn().mockResolvedValue([
      { id: 'dep-1', reservationId: 'res-001', amount: 5000, status: 'HELD', createdAt: new Date() },
    ]),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id === 'dep-1') return { id: 'dep-1', reservationId: 'res-001', amount: 5000, status: 'HELD', createdAt: new Date() };
      return null;
    }),
  };

  // --- Dev-Portal / API Keys ---
  developerApiKey = {
    findMany: jest.fn().mockResolvedValue([
      { id: 'key_1', orgId: 'org_1', label: 'build bot', last4: 'ABCD', active: true, plan: 'free', createdAt: new Date() },
      { id: 'key_2', orgId: 'org_1', label: 'kitchen svc', last4: 'EFGH', active: true, plan: 'pro', createdAt: new Date() },
    ]),
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'key_new',
      orgId: data?.orgId ?? 'org_1',
      label: data?.label ?? 'new key',
      last4: 'WXYZ',
      active: true,
      plan: data?.plan ?? 'free',
      createdAt: new Date(),
    })),
    update: jest.fn().mockImplementation(async ({ where, data }: any) => ({
      id: where?.id ?? 'key_unknown',
      orgId: 'org_1',
      label: data?.label ?? 'updated',
      last4: 'WXYZ',
      active: data?.active ?? false,
      plan: data?.plan ?? 'free',
      updatedAt: new Date(),
    })),
    delete: jest.fn().mockResolvedValue({ id: 'key_deleted' }),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id === 'key_1') return { id: 'key_1', orgId: 'org_1', label: 'build bot', last4: 'ABCD', active: true, plan: 'free', createdAt: new Date() };
      if (where?.id === 'key_2') return { id: 'key_2', orgId: 'org_1', label: 'kitchen svc', last4: 'EFGH', active: true, plan: 'pro', createdAt: new Date() };
      return null;
    }),
  };

  // --- Dev-Portal Production: Org & Subscription Management ---
  org = {
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'org_new',
      name: data?.name ?? 'New Org',
      slug: data?.slug ?? 'new-org',
      createdAt: new Date(),
    })),
    findMany: jest.fn().mockResolvedValue([
      { id: 'org_1', name: 'Test Restaurant', slug: 'test-restaurant', createdAt: new Date() },
    ]),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      if (where?.id === 'org_1') return { id: 'org_1', name: 'Test Restaurant', slug: 'test-restaurant', createdAt: new Date() };
      return null;
    }),
  };

  orgSettings = {
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'settings_new',
      orgId: data?.orgId ?? 'org_new',
      createdAt: new Date(),
    })),
  };

  branch = {
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'branch_new',
      orgId: data?.orgId ?? 'org_new',
      name: data?.name ?? 'Main Branch',
      address: data?.address ?? 'TBD',
      timezone: data?.timezone ?? 'Africa/Kampala',
      createdAt: new Date(),
    })),
    findMany: jest.fn().mockResolvedValue([
      { id: 'branch_1', orgId: 'org_1', name: 'Main Branch', address: '123 Main St', timezone: 'Africa/Kampala', createdAt: new Date() },
    ]),
  };

  user = {
    create: jest.fn().mockImplementation(async ({ data }: any) => ({
      id: 'user_new',
      email: data?.email ?? 'owner@example.com',
      passwordHash: data?.passwordHash ?? 'hashed',
      firstName: data?.firstName ?? 'Owner',
      lastName: data?.lastName ?? 'Account',
      roleLevel: data?.roleLevel ?? 'L5',
      orgId: data?.orgId ?? 'org_new',
      branchId: data?.branchId ?? 'branch_new',
      createdAt: new Date(),
    })),
  };

  devAdmin = {
    upsert: jest.fn().mockImplementation(async ({ where, create, update }: any) => ({
      id: 'devadmin_new',
      email: where?.email ?? create?.email ?? 'dev@chefcloud.local',
      isSuper: update?.isSuper ?? create?.isSuper ?? false,
      createdAt: new Date(),
    })),
    findUnique: jest.fn().mockImplementation(async ({ where }: any) => {
      // Return valid dev admins for test
      if (where?.email === 'dev1@chefcloud.local') {
        return { id: 'devadmin_1', email: 'dev1@chefcloud.local', isSuper: false, createdAt: new Date() };
      }
      if (where?.email === 'superdev@chefcloud.local') {
        return { id: 'devadmin_super', email: 'superdev@chefcloud.local', isSuper: true, createdAt: new Date() };
      }
      if (where?.email === 'lastsuperdev@chefcloud.local') {
        return { id: 'devadmin_last', email: 'lastsuperdev@chefcloud.local', isSuper: true, createdAt: new Date() };
      }
      if (where?.email === 'regulardev@chefcloud.local') {
        return { id: 'devadmin_regular', email: 'regulardev@chefcloud.local', isSuper: false, createdAt: new Date() };
      }
      return null;
    }),
    delete: jest.fn().mockImplementation(async ({ where }: any) => ({
      id: 'devadmin_deleted',
      email: where?.email ?? 'deleted@chefcloud.local',
      isSuper: false,
      deletedAt: new Date(),
    })),
    count: jest.fn().mockImplementation(async ({ where }: any) => {
      // Return count of super devs (simulate minimum 2 constraint)
      if (where?.isSuper === true) {
        return 2; // Minimum to prevent deletion of last super dev
      }
      return 5;
    }),
  };

  // Generic fallback if service references prisma.<model> directly
  [key: string]: any;
}
