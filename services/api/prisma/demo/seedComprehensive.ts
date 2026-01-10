/**
 * Comprehensive Demo Seeding Module
 * 
 * Seeds realistic demo data for all frontend pages:
 * - Tables (for reservations)
 * - Reservations (past, current, future)
 * - Completed orders with payments (for analytics/reports)
 * - Service providers/vendors/suppliers
 * - Journal entries (for finance)
 * - Employee profiles (for staff page)
 * - Time entries/shifts (for attendance)
 * 
 * All IDs are deterministic for consistency.
 */

import { PrismaClient } from '@prisma/client';
import {
  ORG_TAPAS_ID,
  ORG_CAFESSERIE_ID,
  BRANCH_TAPAS_MAIN_ID,
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
} from './constants';
import { seedTapasInventory } from './tapas/inventory';
import { seedCafesserieInventory } from './cafesserie/inventory';
import { seedInventoryLocations } from './seedLocations';
import { seedInventoryPostingMappings } from './seedPostingMappings';

// Deterministic IDs for comprehensive data
const TABLE_IDS = {
  TAPAS: [
    '00000000-0000-4000-8000-000000001001',
    '00000000-0000-4000-8000-000000001002',
    '00000000-0000-4000-8000-000000001003',
    '00000000-0000-4000-8000-000000001004',
    '00000000-0000-4000-8000-000000001005',
    '00000000-0000-4000-8000-000000001006',
    '00000000-0000-4000-8000-000000001007',
    '00000000-0000-4000-8000-000000001008',
    '00000000-0000-4000-8000-000000001009',
    '00000000-0000-4000-8000-000000001010',
  ],
  CAFESSERIE_VILLAGE: [
    '00000000-0000-4000-8000-000000002001',
    '00000000-0000-4000-8000-000000002002',
    '00000000-0000-4000-8000-000000002003',
    '00000000-0000-4000-8000-000000002004',
    '00000000-0000-4000-8000-000000002005',
  ],
  CAFESSERIE_ACACIA: [
    '00000000-0000-4000-8000-000000002101',
    '00000000-0000-4000-8000-000000002102',
    '00000000-0000-4000-8000-000000002103',
    '00000000-0000-4000-8000-000000002104',
    '00000000-0000-4000-8000-000000002105',
  ],
  CAFESSERIE_ARENA: [
    '00000000-0000-4000-8000-000000002201',
    '00000000-0000-4000-8000-000000002202',
    '00000000-0000-4000-8000-000000002203',
    '00000000-0000-4000-8000-000000002204',
    '00000000-0000-4000-8000-000000002205',
  ],
  CAFESSERIE_MOMBASA: [
    '00000000-0000-4000-8000-000000002301',
    '00000000-0000-4000-8000-000000002302',
    '00000000-0000-4000-8000-000000002303',
    '00000000-0000-4000-8000-000000002304',
    '00000000-0000-4000-8000-000000002305',
  ],
};

const SUPPLIER_IDS = {
  TAPAS: [
    '00000000-0000-4000-8000-000000003001',
    '00000000-0000-4000-8000-000000003002',
    '00000000-0000-4000-8000-000000003003',
    '00000000-0000-4000-8000-000000003004',
  ],
  CAFESSERIE: [
    '00000000-0000-4000-8000-000000003101',
    '00000000-0000-4000-8000-000000003102',
    '00000000-0000-4000-8000-000000003103',
  ],
};

/**
 * Seed tables for branches
 */
async function seedTables(prisma: PrismaClient): Promise<void> {
  console.log('\n🪑 Seeding Tables...');

  // Tapas tables (10 tables)
  for (let i = 0; i < 10; i++) {
    await prisma.table.upsert({
      where: { id: TABLE_IDS.TAPAS[i] },
      update: {},
      create: {
        id: TABLE_IDS.TAPAS[i],
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        label: `Table ${i + 1}`,
        capacity: i < 4 ? 2 : i < 7 ? 4 : 6,
        metadata: { x: (i % 5) * 100, y: Math.floor(i / 5) * 100 },
      },
    });
  }
  console.log('  ✅ Created 10 Tapas tables');

  // Cafesserie Village Mall tables (5 tables)
  for (let i = 0; i < 5; i++) {
    await prisma.table.upsert({
      where: { id: TABLE_IDS.CAFESSERIE_VILLAGE[i] },
      update: {},
      create: {
        id: TABLE_IDS.CAFESSERIE_VILLAGE[i],
        orgId: ORG_CAFESSERIE_ID,
        branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
        label: `Table ${i + 1}`,
        capacity: i < 2 ? 2 : 4,
        metadata: { x: (i % 3) * 100, y: Math.floor(i / 3) * 100 },
      },
    });
  }
  console.log('  ✅ Created 5 Cafesserie Village Mall tables');

  // Cafesserie Acacia Mall tables (5 tables)
  for (let i = 0; i < 5; i++) {
    await prisma.table.upsert({
      where: { id: TABLE_IDS.CAFESSERIE_ACACIA[i] },
      update: {},
      create: {
        id: TABLE_IDS.CAFESSERIE_ACACIA[i],
        orgId: ORG_CAFESSERIE_ID,
        branchId: BRANCH_CAFE_ACACIA_MALL_ID,
        label: `Table ${i + 1}`,
        capacity: i < 2 ? 2 : 4,
        metadata: { x: (i % 3) * 100, y: Math.floor(i / 3) * 100 },
      },
    });
  }
  console.log('  ✅ Created 5 Cafesserie Acacia Mall tables');

  // Cafesserie Arena Mall tables (5 tables)
  for (let i = 0; i < 5; i++) {
    await prisma.table.upsert({
      where: { id: TABLE_IDS.CAFESSERIE_ARENA[i] },
      update: {},
      create: {
        id: TABLE_IDS.CAFESSERIE_ARENA[i],
        orgId: ORG_CAFESSERIE_ID,
        branchId: BRANCH_CAFE_ARENA_MALL_ID,
        label: `Table ${i + 1}`,
        capacity: i < 2 ? 2 : 4,
        metadata: { x: (i % 3) * 100, y: Math.floor(i / 3) * 100 },
      },
    });
  }
  console.log('  ✅ Created 5 Cafesserie Arena Mall tables');

  // Cafesserie Mombasa tables (5 tables)
  for (let i = 0; i < 5; i++) {
    await prisma.table.upsert({
      where: { id: TABLE_IDS.CAFESSERIE_MOMBASA[i] },
      update: {},
      create: {
        id: TABLE_IDS.CAFESSERIE_MOMBASA[i],
        orgId: ORG_CAFESSERIE_ID,
        branchId: BRANCH_CAFE_MOMBASA_ID,
        label: `Table ${i + 1}`,
        capacity: i < 2 ? 2 : 4,
        metadata: { x: (i % 3) * 100, y: Math.floor(i / 3) * 100 },
      },
    });
  }
  console.log('  ✅ Created 5 Cafesserie Mombasa tables');
}

/**
 * Helper to create a datetime from a base date and time string
 */
function createDateTime(baseDate: Date, timeStr: string): Date {
  const [hours, minutes] = timeStr.split(':').map(Number);
  const dt = new Date(baseDate);
  dt.setHours(hours, minutes, 0, 0);
  return dt;
}

/**
 * Seed reservations (past, current, future)
 */
async function seedReservations(prisma: PrismaClient): Promise<void> {
  console.log('\n📅 Seeding Reservations...');

  const now = new Date();
  
  // Helper to create reservation data
  const createReservation = (
    id: string,
    orgId: string,
    branchId: string,
    tableId: string,
    name: string,
    phone: string,
    partySize: number,
    baseDate: Date,
    startTime: string,
    endTime: string,
    status: string,
  ) => ({
    id,
    orgId,
    branchId,
    tableId,
    name,
    phone,
    partySize,
    startAt: createDateTime(baseDate, startTime),
    endAt: createDateTime(baseDate, endTime),
    status,
  });

  const reservationData = [
    // Tapas - Past reservations (seated/completed)
    createReservation(
      '00000000-0000-4000-8000-000000004001',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[0],
      'John Smith',
      '+256700111222',
      2,
      new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
      '19:00',
      '21:00',
      'SEATED',
    ),
    createReservation(
      '00000000-0000-4000-8000-000000004002',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[2],
      'Mary Johnson',
      '+256700222333',
      4,
      new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
      '18:30',
      '20:30',
      'SEATED',
    ),
    createReservation(
      '00000000-0000-4000-8000-000000004003',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[4],
      'David Williams',
      '+256700333444',
      6,
      new Date(now.getTime() - 1 * 24 * 60 * 60 * 1000), // Yesterday
      '20:00',
      '22:00',
      'CANCELLED',
    ),
    // Tapas - Today's reservations
    createReservation(
      '00000000-0000-4000-8000-000000004004',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[1],
      'Sarah Brown',
      '+256700444555',
      2,
      now,
      '12:00',
      '14:00',
      'CONFIRMED',
    ),
    createReservation(
      '00000000-0000-4000-8000-000000004005',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[3],
      'Michael Davis',
      '+256700555666',
      4,
      now,
      '19:00',
      '21:00',
      'CONFIRMED',
    ),
    // Tapas - Future reservations
    createReservation(
      '00000000-0000-4000-8000-000000004006',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[5],
      'Emily Wilson',
      '+256700666777',
      8,
      new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
      '18:00',
      '21:00',
      'HELD',
    ),
    createReservation(
      '00000000-0000-4000-8000-000000004007',
      ORG_TAPAS_ID,
      BRANCH_TAPAS_MAIN_ID,
      TABLE_IDS.TAPAS[6],
      'Robert Taylor',
      '+256700777888',
      2,
      new Date(now.getTime() + 5 * 24 * 60 * 60 * 1000), // 5 days from now
      '20:00',
      '22:00',
      'CONFIRMED',
    ),
    // Cafesserie Village Mall reservations
    createReservation(
      '00000000-0000-4000-8000-000000004101',
      ORG_CAFESSERIE_ID,
      BRANCH_CAFE_VILLAGE_MALL_ID,
      TABLE_IDS.CAFESSERIE_VILLAGE[0],
      'Alice Thompson',
      '+256700888999',
      2,
      now,
      '10:00',
      '11:30',
      'CONFIRMED',
    ),
    createReservation(
      '00000000-0000-4000-8000-000000004102',
      ORG_CAFESSERIE_ID,
      BRANCH_CAFE_VILLAGE_MALL_ID,
      TABLE_IDS.CAFESSERIE_VILLAGE[2],
      'James Anderson',
      '+256700999000',
      4,
      new Date(now.getTime() + 1 * 24 * 60 * 60 * 1000), // Tomorrow
      '15:00',
      '17:00',
      'HELD',
    ),
  ];

  for (const res of reservationData) {
    await prisma.reservation.upsert({
      where: { id: res.id },
      update: {},
      create: res as any,
    });
  }
  console.log(`  ✅ Created ${reservationData.length} reservations`);
}

/**
 * Seed suppliers/vendors (service providers)
 */
async function seedSuppliers(prisma: PrismaClient): Promise<void> {
  console.log('\n🏭 Seeding Suppliers/Service Providers...');

  const suppliers = [
    // Tapas suppliers
    {
      id: SUPPLIER_IDS.TAPAS[0],
      orgId: ORG_TAPAS_ID,
      name: 'Fresh Farms Uganda',
      contact: 'John Mukasa',
      email: 'orders@freshfarms.ug',
      phone: '+256700100100',
      leadTimeDays: 2,
      metadata: {
        address: 'Entebbe Road, Kampala',
        taxId: 'UG123456789',
        paymentTerms: 30,
        notes: 'Primary produce supplier',
      },
    },
    {
      id: SUPPLIER_IDS.TAPAS[1],
      orgId: ORG_TAPAS_ID,
      name: 'Kampala Beverages Ltd',
      contact: 'Sarah Nakato',
      email: 'sales@kampalabev.com',
      phone: '+256700200200',
      leadTimeDays: 1,
      metadata: {
        address: 'Industrial Area, Kampala',
        taxId: 'UG987654321',
        paymentTerms: 14,
        notes: 'Drinks and beverages',
      },
    },
    {
      id: SUPPLIER_IDS.TAPAS[2],
      orgId: ORG_TAPAS_ID,
      name: 'Quality Meats Co',
      contact: 'Peter Okello',
      email: 'info@qualitymeats.ug',
      phone: '+256700300300',
      leadTimeDays: 1,
      metadata: {
        address: 'Nakawa Industrial Park',
        taxId: 'UG456789123',
        paymentTerms: 7,
        notes: 'Meat and poultry supplier',
      },
    },
    {
      id: SUPPLIER_IDS.TAPAS[3],
      orgId: ORG_TAPAS_ID,
      name: 'Seafood Express',
      contact: 'Grace Nambi',
      email: 'orders@seafoodexpress.ug',
      phone: '+256700400400',
      leadTimeDays: 1,
      metadata: {
        address: 'Jinja, Uganda',
        taxId: 'UG789123456',
        paymentTerms: 7,
        notes: 'Fresh seafood delivery',
      },
    },
    // Cafesserie suppliers
    {
      id: SUPPLIER_IDS.CAFESSERIE[0],
      orgId: ORG_CAFESSERIE_ID,
      name: 'East Africa Coffee Roasters',
      contact: 'David Ssemakula',
      email: 'bulk@eacoffee.com',
      phone: '+256700500500',
      leadTimeDays: 3,
      metadata: {
        address: 'Namanve Industrial Park',
        taxId: 'UG321654987',
        paymentTerms: 30,
        notes: 'Premium coffee beans',
      },
    },
    {
      id: SUPPLIER_IDS.CAFESSERIE[1],
      orgId: ORG_CAFESSERIE_ID,
      name: 'Bakery Supplies Uganda',
      contact: 'Mary Achieng',
      email: 'wholesale@bakerysupplies.ug',
      phone: '+256700600600',
      leadTimeDays: 2,
      metadata: {
        address: 'Bugolobi, Kampala',
        taxId: 'UG654987321',
        paymentTerms: 14,
        notes: 'Flour, sugar, baking ingredients',
      },
    },
    {
      id: SUPPLIER_IDS.CAFESSERIE[2],
      orgId: ORG_CAFESSERIE_ID,
      name: 'Dairy Fresh Ltd',
      contact: 'James Tumusiime',
      email: 'orders@dairyfresh.ug',
      phone: '+256700700700',
      leadTimeDays: 1,
      metadata: {
        address: 'Mbarara, Uganda',
        taxId: 'UG147258369',
        paymentTerms: 7,
        notes: 'Milk, cream, butter',
      },
    },
  ];

  for (const supplier of suppliers) {
    await prisma.supplier.upsert({
      where: { id: supplier.id },
      update: {},
      create: supplier,
    });
  }
  console.log(`  ✅ Created ${suppliers.length} suppliers`);
}

/**
 * Seed service providers (for the Service Providers page - different from Suppliers)
 */
async function seedServiceProviders(prisma: PrismaClient): Promise<void> {
  console.log('\n🏢 Seeding Service Providers...');

  const SERVICE_PROVIDER_IDS = {
    TAPAS: [
      '00000000-0000-4000-8000-000000008001',
      '00000000-0000-4000-8000-000000008002',
      '00000000-0000-4000-8000-000000008003',
      '00000000-0000-4000-8000-000000008004',
      '00000000-0000-4000-8000-000000008005',
    ],
    CAFESSERIE: [
      '00000000-0000-4000-8000-000000008101',
      '00000000-0000-4000-8000-000000008102',
      '00000000-0000-4000-8000-000000008103',
    ],
  };

  const serviceProviders = [
    // Tapas service providers
    {
      id: SERVICE_PROVIDER_IDS.TAPAS[0],
      orgId: ORG_TAPAS_ID,
      branchId: BRANCH_TAPAS_MAIN_ID,
      name: 'Kololo Properties Ltd',
      category: 'RENT',
      contactName: 'Joseph Mwesigwa',
      contactEmail: 'joseph@kololoproperties.ug',
      contactPhone: '+256700800100',
      notes: 'Landlord - rent due on 1st of each month',
    },
    {
      id: SERVICE_PROVIDER_IDS.TAPAS[1],
      orgId: ORG_TAPAS_ID,
      branchId: BRANCH_TAPAS_MAIN_ID,
      name: 'MTN Business Uganda',
      category: 'INTERNET',
      contactName: 'Customer Service',
      contactEmail: 'business@mtn.co.ug',
      contactPhone: '+256800100100',
      notes: '100Mbps fiber connection',
    },
    {
      id: SERVICE_PROVIDER_IDS.TAPAS[2],
      orgId: ORG_TAPAS_ID,
      branchId: BRANCH_TAPAS_MAIN_ID,
      name: 'Umeme Limited',
      category: 'ELECTRICITY',
      contactName: 'Accounts Dept',
      contactEmail: 'accounts@umeme.co.ug',
      contactPhone: '+256200555555',
      notes: 'Pre-paid meter account',
    },
    {
      id: SERVICE_PROVIDER_IDS.TAPAS[3],
      orgId: ORG_TAPAS_ID,
      branchId: BRANCH_TAPAS_MAIN_ID,
      name: 'CleanPro Services',
      category: 'CLEANING',
      contactName: 'Mary Nakato',
      contactEmail: 'info@cleanpro.ug',
      contactPhone: '+256700800400',
      notes: 'Weekly deep cleaning service',
    },
    {
      id: SERVICE_PROVIDER_IDS.TAPAS[4],
      orgId: ORG_TAPAS_ID,
      branchId: BRANCH_TAPAS_MAIN_ID,
      name: 'Securiforce Uganda',
      category: 'SECURITY',
      contactName: 'John Okello',
      contactEmail: 'operations@securiforce.ug',
      contactPhone: '+256700800500',
      notes: '24/7 security guard service',
    },
    // Cafesserie service providers
    {
      id: SERVICE_PROVIDER_IDS.CAFESSERIE[0],
      orgId: ORG_CAFESSERIE_ID,
      branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
      name: 'Village Mall Management',
      category: 'RENT',
      contactName: 'Grace Atim',
      contactEmail: 'leasing@villagemall.ug',
      contactPhone: '+256700900100',
      notes: 'Mall rental - includes CAM fees',
    },
    {
      id: SERVICE_PROVIDER_IDS.CAFESSERIE[1],
      orgId: ORG_CAFESSERIE_ID,
      branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
      name: 'Airtel Business',
      category: 'INTERNET',
      contactName: 'Business Support',
      contactEmail: 'business@airtel.ug',
      contactPhone: '+256417000000',
      notes: '50Mbps dedicated line',
    },
    {
      id: SERVICE_PROVIDER_IDS.CAFESSERIE[2],
      orgId: ORG_CAFESSERIE_ID,
      branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
      name: 'NWSC',
      category: 'WATER',
      contactName: 'Customer Care',
      contactEmail: 'customercare@nwsc.co.ug',
      contactPhone: '+256313000800',
      notes: 'Water utility',
    },
  ];

  for (const provider of serviceProviders) {
    await prisma.serviceProvider.upsert({
      where: { id: provider.id },
      update: {},
      create: provider as any,
    });
  }
  console.log(`  ✅ Created ${serviceProviders.length} service providers`);
}

/**
 * Seed completed orders with payments (for analytics)
 */
/**
 * Seed completed orders for a specific branch
 * This is extracted to be reusable across all branches (Tapas + Cafesserie)
 */
async function seedOrdersForBranch(
  prisma: PrismaClient,
  config: {
    branchId: string;
    orgId: string;
    tableIds: string[];
    orderIdPrefix: string; // e.g., '0005' for Tapas, '1005' for Village, etc.
    daysBack?: number;
    ordersPerWeekday?: number;
    ordersPerWeekend?: number;
  }
): Promise<number> {
  const {
    branchId,
    orgId,
    tableIds,
    orderIdPrefix,
    daysBack = 30,
    ordersPerWeekday = 8,
    ordersPerWeekend = 12,
  } = config;

  // Get menu items for this branch
  const menuItems = await prisma.menuItem.findMany({
    where: { branchId },
    take: 20,
  });

  if (menuItems.length === 0) {
    console.log(`  ⚠️  No menu items found for branch ${branchId}, skipping`);
    return 0;
  }

  // Get users for this org
  const users = await prisma.user.findMany({
    where: { orgId },
    take: 5,
  });

  if (users.length === 0) {
    console.log(`  ⚠️  No users found for org ${orgId}, skipping`);
    return 0;
  }

  const now = new Date();
  let orderCount = 0;

  // Create orders for the last N days
  for (let daysAgo = daysBack; daysAgo >= 0; daysAgo--) {
    const orderDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    
    // Vary orders by weekday
    const dayOfWeek = orderDate.getDay();
    const ordersToday = dayOfWeek === 0 || dayOfWeek === 6 ? ordersPerWeekend : ordersPerWeekday;
    
    for (let orderNum = 0; orderNum < ordersToday; orderNum++) {
      const orderId = `00000000-0000-4000-8000-0000${orderIdPrefix}${String(daysAgo).padStart(2, '0')}${String(orderNum).padStart(2, '0')}`;
      
      // Select random items for this order (2-5 items)
      const numItems = 2 + Math.floor(Math.random() * 4);
      const selectedItems = menuItems
        .sort(() => Math.random() - 0.5)
        .slice(0, numItems);
      
      // Calculate total
      let subtotal = 0;
      const orderItems: any[] = [];
      
      for (let i = 0; i < selectedItems.length; i++) {
        const item = selectedItems[i];
        const quantity = 1 + Math.floor(Math.random() * 2);
        const itemTotal = Number(item.price) * quantity;
        subtotal += itemTotal;
        
        orderItems.push({
          id: `${orderId}-item-${i}`,
          orderId,
          menuItemId: item.id,
          quantity,
          price: Number(item.price),
          subtotal: itemTotal,
        });
      }

      const taxAmount = subtotal * 0.18;
      const total = subtotal + taxAmount;
      const user = users[Math.floor(Math.random() * users.length)];

      // Generate order number (format: ORD-YYYYMMDD-XXXX)
      const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
      const orderNumber = `ORD-${dateStr}-${String(orderCount + 1).padStart(4, '0')}`;

      // Pick a random table from this branch's tables
      const tableId = tableIds[Math.floor(Math.random() * tableIds.length)];
      const serviceType = Math.random() > 0.3 ? 'DINE_IN' : 'TAKEAWAY';

      // Create order
      await prisma.order.upsert({
        where: { id: orderId },
        update: {},
        create: {
          id: orderId,
          orderNumber,
          branchId,
          userId: user.id,
          tableId: serviceType === 'DINE_IN' ? tableId : null,
          status: 'CLOSED',
          serviceType: serviceType as any,
          subtotal,
          tax: taxAmount,
          total,
          createdAt: orderDate,
          updatedAt: orderDate,
        },
      });

      // Create order items
      for (const orderItem of orderItems) {
        await prisma.orderItem.upsert({
          where: { id: orderItem.id },
          update: {},
          create: orderItem,
        });
      }

      // Create payment (PaymentMethod: CASH, CARD, MOMO)
      const paymentId = `${orderId}-payment`;
      const paymentMethods = ['CASH', 'CARD', 'MOMO'] as const;
      await prisma.payment.upsert({
        where: { id: paymentId },
        update: {},
        create: {
          id: paymentId,
          orderId,
          method: paymentMethods[Math.floor(Math.random() * 3)],
          amount: total,
          status: 'completed',
          createdAt: orderDate,
        },
      });

      orderCount++;
    }
  }

  return orderCount;
}

/**
 * Seed OPEN orders for POS "live orders" feeling
 * These are orders from the last 24 hours that are not yet closed
 */
async function seedOpenOrders(
  prisma: PrismaClient,
  config: {
    branchId: string;
    orgId: string;
    tableIds: string[];
    orderIdPrefix: string; // Different prefix from closed orders
    ordersCount?: number;
  }
): Promise<number> {
  const {
    branchId,
    orgId,
    tableIds,
    orderIdPrefix,
    ordersCount = 12,
  } = config;

  // Get menu items for this branch
  const menuItems = await prisma.menuItem.findMany({
    where: { branchId },
    take: 20,
  });

  if (menuItems.length === 0) {
    console.log(`  ⚠️  No menu items found for branch ${branchId}, skipping open orders`);
    return 0;
  }

  // Get users for this org
  const users = await prisma.user.findMany({
    where: { orgId },
    take: 5,
  });

  if (users.length === 0) {
    console.log(`  ⚠️  No users found for org ${orgId}, skipping open orders`);
    return 0;
  }

  const now = new Date();
  let createdCount = 0;
  
  // Statuses for active orders (not CLOSED)
  const activeStatuses = ['NEW', 'SENT', 'SERVED'];

  // Create open orders from last 24 hours
  for (let i = 0; i < ordersCount; i++) {
    // Random time within last 24 hours
    const hoursAgo = Math.floor(Math.random() * 24);
    const minutesAgo = Math.floor(Math.random() * 60);
    const orderDate = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000) - (minutesAgo * 60 * 1000));
    
    const orderId = `00000000-0000-4000-8000-0000${orderIdPrefix}${String(i).padStart(4, '0')}`;
    
    // Select random items (2-5 items)
    const numItems = 2 + Math.floor(Math.random() * 4);
    const selectedItems = menuItems
      .sort(() => Math.random() - 0.5)
      .slice(0, numItems);
    
    // Calculate total
    let subtotal = 0;
    const orderItems: any[] = [];
    
    for (let j = 0; j < selectedItems.length; j++) {
      const item = selectedItems[j];
      const quantity = 1 + Math.floor(Math.random() * 2);
      const itemTotal = Number(item.price) * quantity;
      subtotal += itemTotal;
      
      orderItems.push({
        id: `${orderId}-item-${j}`,
        orderId,
        menuItemId: item.id,
        quantity,
        price: Number(item.price),
        subtotal: itemTotal,
      });
    }

    const taxAmount = subtotal * 0.18;
    const total = subtotal + taxAmount;
    const user = users[Math.floor(Math.random() * users.length)];

    // Generate order number
    const dateStr = orderDate.toISOString().slice(0, 10).replace(/-/g, '');
    const orderNumber = `ORD-${dateStr}-${String(9000 + i).padStart(4, '0')}`;

    // Pick random table and status
    const tableId = tableIds[Math.floor(Math.random() * tableIds.length)];
    const status = activeStatuses[Math.floor(Math.random() * activeStatuses.length)];
    const serviceType = Math.random() > 0.3 ? 'DINE_IN' : 'TAKEAWAY';

    // Create order (no payment for open orders)
    await prisma.order.upsert({
      where: { id: orderId },
      update: {},
      create: {
        id: orderId,
        orderNumber,
        branchId,
        userId: user.id,
        tableId: serviceType === 'DINE_IN' ? tableId : null,
        status: status as any,
        serviceType: serviceType as any,
        subtotal,
        tax: taxAmount,
        total,
        createdAt: orderDate,
        updatedAt: orderDate,
      },
    });

    // Create order items
    for (const orderItem of orderItems) {
      await prisma.orderItem.upsert({
        where: { id: orderItem.id },
        update: {},
        create: orderItem,
      });
    }

    createdCount++;
  }

  return createdCount;
}

/**
 * Main function to seed all completed orders across all branches
 */
async function seedCompletedOrders(prisma: PrismaClient): Promise<void> {
  console.log('\n💰 Seeding Completed Orders with Payments...');

  // Seed Tapas orders
  const tapasCount = await seedOrdersForBranch(prisma, {
    branchId: BRANCH_TAPAS_MAIN_ID,
    orgId: ORG_TAPAS_ID,
    tableIds: TABLE_IDS.TAPAS,
    orderIdPrefix: '0005',
  });
  console.log(`  ✅ Tapas: Created ${tapasCount} completed orders`);

  // Seed Cafesserie Village Mall orders
  const villageCount = await seedOrdersForBranch(prisma, {
    branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_VILLAGE,
    orderIdPrefix: '1005',
  });
  console.log(`  ✅ Village Mall: Created ${villageCount} completed orders`);

  // Seed Cafesserie Acacia Mall orders
  const acaciaCount = await seedOrdersForBranch(prisma, {
    branchId: BRANCH_CAFE_ACACIA_MALL_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_ACACIA,
    orderIdPrefix: '2005',
  });
  console.log(`  ✅ Acacia Mall: Created ${acaciaCount} completed orders`);

  // Seed Cafesserie Arena Mall orders
  const arenaCount = await seedOrdersForBranch(prisma, {
    branchId: BRANCH_CAFE_ARENA_MALL_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_ARENA,
    orderIdPrefix: '3005',
  });
  console.log(`  ✅ Arena Mall: Created ${arenaCount} completed orders`);

  // Seed Cafesserie Mombasa orders
  const mombasaCount = await seedOrdersForBranch(prisma, {
    branchId: BRANCH_CAFE_MOMBASA_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_MOMBASA,
    orderIdPrefix: '4005',
  });
  console.log(`  ✅ Mombasa: Created ${mombasaCount} completed orders`);

  const totalClosed = tapasCount + villageCount + acaciaCount + arenaCount + mombasaCount;
  console.log(`  ✅ Total completed orders: ${totalClosed}`);
}

/**
 * Seed OPEN orders for all branches (for POS live orders)
 */
async function seedLiveOrders(prisma: PrismaClient): Promise<void> {
  console.log('\n📱 Seeding OPEN Orders for POS...');

  // Seed Tapas open orders
  const tapasOpen = await seedOpenOrders(prisma, {
    branchId: BRANCH_TAPAS_MAIN_ID,
    orgId: ORG_TAPAS_ID,
    tableIds: TABLE_IDS.TAPAS,
    orderIdPrefix: '8005',
    ordersCount: 12,
  });
  console.log(`  ✅ Tapas: Created ${tapasOpen} open orders`);

  // Seed Cafesserie Village Mall open orders
  const villageOpen = await seedOpenOrders(prisma, {
    branchId: BRANCH_CAFE_VILLAGE_MALL_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_VILLAGE,
    orderIdPrefix: '9005',
    ordersCount: 12,
  });
  console.log(`  ✅ Village Mall: Created ${villageOpen} open orders`);

  // Seed Cafesserie Acacia Mall open orders
  const acaciaOpen = await seedOpenOrders(prisma, {
    branchId: BRANCH_CAFE_ACACIA_MALL_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_ACACIA,
    orderIdPrefix: '9105',
    ordersCount: 12,
  });
  console.log(`  ✅ Acacia Mall: Created ${acaciaOpen} open orders`);

  // Seed Cafesserie Arena Mall open orders
  const arenaOpen = await seedOpenOrders(prisma, {
    branchId: BRANCH_CAFE_ARENA_MALL_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_ARENA,
    orderIdPrefix: '9205',
    ordersCount: 12,
  });
  console.log(`  ✅ Arena Mall: Created ${arenaOpen} open orders`);

  // Seed Cafesserie Mombasa open orders
  const mombasaOpen = await seedOpenOrders(prisma, {
    branchId: BRANCH_CAFE_MOMBASA_ID,
    orgId: ORG_CAFESSERIE_ID,
    tableIds: TABLE_IDS.CAFESSERIE_MOMBASA,
    orderIdPrefix: '9305',
    ordersCount: 12,
  });
  console.log(`  ✅ Mombasa: Created ${mombasaOpen} open orders`);

  const totalOpen = tapasOpen + villageOpen + acaciaOpen + arenaOpen + mombasaOpen;
  console.log(`  ✅ Total open orders: ${totalOpen}`);
}

/**
 * Seed journal entries for finance page
 * Seeds for BOTH Tapas (single branch) and Cafesserie (4 branches) with branch-level data
 */
async function seedJournalEntries(prisma: PrismaClient): Promise<void> {
  console.log('\n📒 Seeding Journal Entries...');

  const orgs = [
    { 
      id: ORG_TAPAS_ID, 
      name: 'Tapas',
      prefix: '6', 
      branches: [
        { id: BRANCH_TAPAS_MAIN_ID, name: 'Main', multiplier: 1.0 }
      ]
    },
    { 
      id: ORG_CAFESSERIE_ID, 
      name: 'Cafesserie',
      prefix: '7',
      branches: [
        { id: BRANCH_CAFE_VILLAGE_MALL_ID, name: 'Village Mall', multiplier: 1.2 },
        { id: BRANCH_CAFE_ACACIA_MALL_ID, name: 'Acacia Mall', multiplier: 1.0 },
        { id: BRANCH_CAFE_ARENA_MALL_ID, name: 'Arena Mall', multiplier: 0.8 },
        { id: BRANCH_CAFE_MOMBASA_ID, name: 'Mombasa', multiplier: 0.6 },
      ]
    },
  ];

  let totalEntryCount = 0;

  for (const org of orgs) {
    // Get accounts for this org
    const accounts = await prisma.account.findMany({
      where: { orgId: org.id },
    });

    if (accounts.length === 0) {
      console.log(`  ⚠️  No accounts found for ${org.name}, skipping journal entries`);
      continue;
    }

    const cashAccount = accounts.find(a => a.code === '1000');
    const arAccount = accounts.find(a => a.code === '1100');
    const inventoryAccount = accounts.find(a => a.code === '1200');
    const apAccount = accounts.find(a => a.code === '2000');
    const salesAccount = accounts.find(a => a.code === '4000');
    const cogsAccount = accounts.find(a => a.code === '5000');
    const salariesAccount = accounts.find(a => a.code === '6100');
    const rentAccount = accounts.find(a => a.code === '6200');

    if (!cashAccount || !salesAccount) {
      console.log(`  ⚠️  Required accounts not found for ${org.name}, skipping journal entries`);
      continue;
    }

    const now = new Date();
    let orgEntryCount = 0;

    for (const branch of org.branches) {
      const branchIndex = org.branches.indexOf(branch);
      
      // Create journal entries for last 30 days
      for (let daysAgo = 30; daysAgo >= 0; daysAgo--) {
        const entryDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
        const dateStr = entryDate.toISOString().split('T')[0];
        
        // Daily sales entry with COGS
        const salesAmount = Math.floor((500000 + Math.random() * 1000000) * branch.multiplier); // 500k - 1.5m UGX * multiplier
        const cogsAmount = Math.floor(salesAmount * 0.35); // 35% cost of goods
        const salesEntryId = `00000000-0000-4000-8000-0000000${org.prefix}${branchIndex}${String(daysAgo).padStart(2, '0')}01`;
        
        await prisma.journalEntry.upsert({
          where: { id: salesEntryId },
          update: {},
          create: {
            id: salesEntryId,
            orgId: org.id,
            branchId: branch.id,
            date: entryDate,
            memo: `Daily sales - ${branch.name} - ${dateStr}`,
            source: 'POS_SALE',
            sourceId: `SALES-${branch.name.substring(0, 3).toUpperCase()}-${dateStr}`,
            createdAt: entryDate,
          },
        });

        // Lines: Debit Cash, Credit Sales, Debit COGS, Credit Inventory
        const salesLines = [
          { id: `${salesEntryId}-L1`, accountId: cashAccount.id, debit: salesAmount, credit: 0 },
          { id: `${salesEntryId}-L2`, accountId: salesAccount.id, debit: 0, credit: salesAmount },
        ];
        
        if (cogsAccount && inventoryAccount) {
          salesLines.push(
            { id: `${salesEntryId}-L3`, accountId: cogsAccount.id, debit: cogsAmount, credit: 0 },
            { id: `${salesEntryId}-L4`, accountId: inventoryAccount.id, debit: 0, credit: cogsAmount },
          );
        }

        for (const line of salesLines) {
          await prisma.journalLine.upsert({
            where: { id: line.id },
            update: {},
            create: {
              id: line.id,
              entryId: salesEntryId,
              accountId: line.accountId,
              debit: line.debit,
              credit: line.credit,
            },
          });
        }
        orgEntryCount++;

        // Weekly inventory purchase (every Monday)
        if (daysAgo % 7 === 0 && inventoryAccount && apAccount) {
          const purchaseAmount = Math.floor((200000 + Math.random() * 300000) * branch.multiplier);
          const purchaseEntryId = `00000000-0000-4000-8000-0000000${org.prefix}${branchIndex}${String(daysAgo).padStart(2, '0')}02`;
          
          await prisma.journalEntry.upsert({
            where: { id: purchaseEntryId },
            update: {},
            create: {
              id: purchaseEntryId,
              orgId: org.id,
              branchId: branch.id,
              date: entryDate,
              memo: `Inventory purchase - ${branch.name} - ${dateStr}`,
              source: 'VENDOR_PAYMENT',
              sourceId: `INV-${branch.name.substring(0, 3).toUpperCase()}-${dateStr}`,
              createdAt: entryDate,
            },
          });

          // Debit Inventory, Credit AP
          for (const line of [
            { id: `${purchaseEntryId}-L1`, accountId: inventoryAccount.id, debit: purchaseAmount, credit: 0 },
            { id: `${purchaseEntryId}-L2`, accountId: apAccount.id, debit: 0, credit: purchaseAmount },
          ]) {
            await prisma.journalLine.upsert({
              where: { id: line.id },
              update: {},
              create: {
                id: line.id,
                entryId: purchaseEntryId,
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
              },
            });
          }
          orgEntryCount++;
        }

        // Bi-weekly payroll (every 14 days)
        if (daysAgo % 14 === 0 && salariesAccount) {
          const payrollAmount = Math.floor((800000 + Math.random() * 400000) * branch.multiplier);
          const payrollEntryId = `00000000-0000-4000-8000-0000000${org.prefix}${branchIndex}${String(daysAgo).padStart(2, '0')}03`;
          
          await prisma.journalEntry.upsert({
            where: { id: payrollEntryId },
            update: {},
            create: {
              id: payrollEntryId,
              orgId: org.id,
              branchId: branch.id,
              date: entryDate,
              memo: `Payroll - ${branch.name} - ${dateStr}`,
              source: 'PAYROLL',
              sourceId: `PAY-${branch.name.substring(0, 3).toUpperCase()}-${dateStr}`,
              createdAt: entryDate,
            },
          });

          // Debit Salaries, Credit Cash
          for (const line of [
            { id: `${payrollEntryId}-L1`, accountId: salariesAccount.id, debit: payrollAmount, credit: 0 },
            { id: `${payrollEntryId}-L2`, accountId: cashAccount.id, debit: 0, credit: payrollAmount },
          ]) {
            await prisma.journalLine.upsert({
              where: { id: line.id },
              update: {},
              create: {
                id: line.id,
                entryId: payrollEntryId,
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
              },
            });
          }
          orgEntryCount++;
        }

        // Monthly rent (1st of month)
        if (entryDate.getDate() === 1 && rentAccount) {
          const rentAmount = Math.floor(1500000 * branch.multiplier);
          const rentEntryId = `00000000-0000-4000-8000-0000000${org.prefix}${branchIndex}${String(daysAgo).padStart(2, '0')}04`;
          
          await prisma.journalEntry.upsert({
            where: { id: rentEntryId },
            update: {},
            create: {
              id: rentEntryId,
              orgId: org.id,
              branchId: branch.id,
              date: entryDate,
              memo: `Monthly rent - ${branch.name} - ${dateStr}`,
              source: 'EXPENSE',
              sourceId: `RENT-${branch.name.substring(0, 3).toUpperCase()}-${entryDate.getMonth() + 1}`,
              createdAt: entryDate,
            },
          });

          // Debit Rent, Credit Cash
          for (const line of [
            { id: `${rentEntryId}-L1`, accountId: rentAccount.id, debit: rentAmount, credit: 0 },
            { id: `${rentEntryId}-L2`, accountId: cashAccount.id, debit: 0, credit: rentAmount },
          ]) {
            await prisma.journalLine.upsert({
              where: { id: line.id },
              update: {},
              create: {
                id: line.id,
                entryId: rentEntryId,
                accountId: line.accountId,
                debit: line.debit,
                credit: line.credit,
              },
            });
          }
          orgEntryCount++;
        }
      }
    }

    console.log(`  ✅ Created ${orgEntryCount} journal entries for ${org.name}`);
    totalEntryCount += orgEntryCount;
  }

  console.log(`  📊 Total journal entries: ${totalEntryCount}`);
}

/**
 * Seed Employees (required for StaffAward, separate from EmployeeProfile)
 * Seeds for BOTH Tapas and Cafesserie orgs
 */
async function seedEmployees(prisma: PrismaClient): Promise<void> {
  console.log('\n👔 Seeding Employees...');

  // Seed Tapas employees
  const tapasUsers = await prisma.user.findMany({
    where: { 
      orgId: ORG_TAPAS_ID,
      roleLevel: { in: ['L1', 'L2', 'L3'] }, // Staff roles
    },
  });

  let count = 0;
  for (const user of tapasUsers) {
    const employeeId = `00000000-0000-4000-8000-000000008${String(count).padStart(3, '0')}`;
    const hiredAt = new Date();
    hiredAt.setMonth(hiredAt.getMonth() - (6 + Math.floor(Math.random() * 18))); // 6-24 months ago

    await prisma.employee.upsert({
      where: { id: employeeId },
      update: {},
      create: {
        id: employeeId,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: user.id,
        employeeCode: `EMP-${String(count + 1).padStart(4, '0')}`,
        firstName: user.name?.split(' ')[0] || 'Staff',
        lastName: user.name?.split(' ').slice(1).join(' ') || `Member ${count + 1}`,
        position: user.roleLevel === 'L3' ? 'Supervisor' :
                  user.roleLevel === 'L2' ? 'Senior Server' : 'Server',
        hiredAt,
      },
    });
    count++;
  }

  console.log(`  ✅ Created ${count} Tapas employees`);

  // Seed Cafesserie employees
  const cafeUsers = await prisma.user.findMany({
    where: { 
      orgId: ORG_CAFESSERIE_ID,
      roleLevel: { in: ['L1', 'L2', 'L3'] }, // Staff roles
    },
  });

  let cafeCount = 0;
  for (const user of cafeUsers) {
    // Use different ID range for Cafesserie (9xxx instead of 8xxx)
    const employeeId = `00000000-0000-4000-8000-000000009${String(cafeCount).padStart(3, '0')}`;
    const hiredAt = new Date();
    hiredAt.setMonth(hiredAt.getMonth() - (6 + Math.floor(Math.random() * 18))); // 6-24 months ago

    await prisma.employee.upsert({
      where: { id: employeeId },
      update: {},
      create: {
        id: employeeId,
        orgId: ORG_CAFESSERIE_ID,
        branchId: BRANCH_CAFE_VILLAGE_MALL_ID, // Default to Village Mall branch
        userId: user.id,
        employeeCode: `CAFE-${String(cafeCount + 1).padStart(4, '0')}`,
        firstName: user.name?.split(' ')[0] || 'Staff',
        lastName: user.name?.split(' ').slice(1).join(' ') || `Member ${cafeCount + 1}`,
        position: user.roleLevel === 'L3' ? 'Supervisor' :
                  user.roleLevel === 'L2' ? 'Senior Barista' : 'Barista',
        hiredAt,
      },
    });
    cafeCount++;
  }

  console.log(`  ✅ Created ${cafeCount} Cafesserie employees`);
  console.log(`  ✅ Total: ${count + cafeCount} employees`);
}

/**
 * Seed StaffAwards (monthly recognition)
 */
async function seedStaffAwards(prisma: PrismaClient): Promise<void> {
  console.log('\n🏆 Seeding Staff Awards...');

  const employees = await prisma.employee.findMany({
    where: { orgId: ORG_TAPAS_ID },
    take: 5,
  });

  if (employees.length === 0) {
    console.log('  ⚠️  No employees found, skipping staff awards');
    return;
  }

  // Find an admin to be the creator
  const admin = await prisma.user.findFirst({
    where: { orgId: ORG_TAPAS_ID, roleLevel: 'L4' },
  });
  if (!admin) {
    console.log('  ⚠️  No admin found, skipping staff awards');
    return;
  }

  const now = new Date();
  const categories: Array<'TOP_PERFORMER' | 'HIGHEST_SALES' | 'BEST_SERVICE' | 'MOST_RELIABLE'> = [
    'TOP_PERFORMER', 'HIGHEST_SALES', 'BEST_SERVICE', 'MOST_RELIABLE',
  ];

  let count = 0;

  // Create awards for the last 3 months
  for (let monthsAgo = 0; monthsAgo < 3; monthsAgo++) {
    const periodStart = new Date(now.getFullYear(), now.getMonth() - monthsAgo, 1);
    const periodEnd = new Date(now.getFullYear(), now.getMonth() - monthsAgo + 1, 0);

    // Pick a random employee for each category
    for (const category of categories) {
      const employee = employees[Math.floor(Math.random() * employees.length)];
      const awardId = `00000000-0000-4000-8000-000000009${String(count).padStart(3, '0')}`;
      
      try {
        await prisma.staffAward.upsert({
          where: { id: awardId },
          update: {},
          create: {
            id: awardId,
            orgId: ORG_TAPAS_ID,
            branchId: BRANCH_TAPAS_MAIN_ID,
            employeeId: employee.id,
            periodType: 'MONTH',
            periodStart,
            periodEnd,
            category,
            rank: 1,
            score: 85 + Math.random() * 15, // 85-100
            reason: `Outstanding ${category.toLowerCase().replace('_', ' ')} for ${periodStart.toLocaleString('default', { month: 'long' })}`,
            createdById: admin.id,
          },
        });
        count++;
      } catch (e) {
        // Skip duplicate unique constraint errors
      }
    }
  }

  console.log(`  ✅ Created ${count} staff awards`);
}

/**
 * Seed Customer Feedback (NPS data)
 */
async function seedFeedback(prisma: PrismaClient): Promise<void> {
  console.log('\n📝 Seeding Customer Feedback (NPS)...');

  const now = new Date();
  const channels: Array<'POS' | 'PORTAL' | 'QR' | 'EMAIL'> = ['POS', 'PORTAL', 'QR', 'EMAIL'];
  
  // NPS score distribution: 60% promoters (9-10), 25% passives (7-8), 15% detractors (0-6)
  const getNpsScore = (): number => {
    const rand = Math.random();
    if (rand < 0.60) return 9 + Math.floor(Math.random() * 2); // 9-10 (promoters)
    if (rand < 0.85) return 7 + Math.floor(Math.random() * 2); // 7-8 (passives)
    return Math.floor(Math.random() * 7); // 0-6 (detractors)
  };

  const getNpsCategory = (score: number): 'PROMOTER' | 'PASSIVE' | 'DETRACTOR' => {
    if (score >= 9) return 'PROMOTER';
    if (score >= 7) return 'PASSIVE';
    return 'DETRACTOR';
  };

  const comments = {
    PROMOTER: [
      'Excellent service! Will definitely come back.',
      'The food was amazing and staff were very friendly.',
      'Best dining experience in town!',
      'Already recommending to all my friends.',
      null,
    ],
    PASSIVE: [
      'Good overall, but could improve wait times.',
      'Food was okay, nothing special.',
      'Decent experience.',
      null,
    ],
    DETRACTOR: [
      'Very slow service, waited too long.',
      'Food was cold when served.',
      'Staff seemed disinterested.',
      'Will not be returning.',
      null,
    ],
  };

  let count = 0;

  // Create 200 feedback entries over the last 30 days
  for (let i = 0; i < 200; i++) {
    const daysAgo = Math.floor(Math.random() * 30);
    const createdAt = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    createdAt.setHours(10 + Math.floor(Math.random() * 10), Math.floor(Math.random() * 60));

    const score = getNpsScore();
    const category = getNpsCategory(score);
    const channel = channels[Math.floor(Math.random() * channels.length)];
    const commentList = comments[category];
    const comment = commentList[Math.floor(Math.random() * commentList.length)];

    const feedbackId = `00000000-0000-4000-8000-00000010${String(count).padStart(4, '0')}`;

    await prisma.feedback.upsert({
      where: { id: feedbackId },
      update: {},
      create: {
        id: feedbackId,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        channel,
        score,
        npsCategory: category,
        comment,
        createdAt,
      },
    });
    count++;
  }

  console.log(`  ✅ Created ${count} feedback entries`);
}

/**
 * Seed employee profiles with full data for staff page
 */
async function seedEmployeeProfiles(prisma: PrismaClient): Promise<void> {
  console.log('\n👥 Seeding Employee Profiles...');

  const users = await prisma.user.findMany({
    where: { 
      orgId: { in: [ORG_TAPAS_ID, ORG_CAFESSERIE_ID] },
      roleLevel: { in: ['L1', 'L2', 'L3', 'L4'] }, // Not owners
    },
    include: { employeeProfile: true },
  });

  let profileCount = 0;

  for (const user of users) {
    if (!user.employeeProfile) {
      const employeeCode = `EMP${String(profileCount + 1).padStart(4, '0')}`;
      const hireDate = new Date();
      hireDate.setMonth(hireDate.getMonth() - Math.floor(Math.random() * 24)); // Hired 0-24 months ago
      
      const baseSalary = user.roleLevel === 'L4' ? 2500000 :
                        user.roleLevel === 'L3' ? 1800000 :
                        user.roleLevel === 'L2' ? 1200000 : 800000; // UGX monthly

      await prisma.employeeProfile.create({
        data: {
          userId: user.id,
          employeeCode,
          badgeCode: `BADGE-${String(profileCount + 1).padStart(3, '0')}`,
          metadata: {
            hireDate: hireDate.toISOString(),
            baseSalary,
            salaryFrequency: 'MONTHLY',
            department: user.roleLevel === 'L4' ? 'Management' :
                       user.roleLevel === 'L3' ? 'Supervision' :
                       user.roleLevel === 'L2' ? 'Operations' : 'Service',
          },
        },
      });
      profileCount++;
    }
  }

  console.log(`  ✅ Created ${profileCount} employee profiles`);
}

/**
 * Seed time entries for attendance tracking
 */
async function seedTimeEntries(prisma: PrismaClient): Promise<void> {
  console.log('\n⏰ Seeding Time Entries...');

  const employees = await prisma.user.findMany({
    where: { 
      orgId: ORG_TAPAS_ID,
      roleLevel: { in: ['L1', 'L2', 'L3'] }, // Staff who clock in/out
    },
  });

  if (employees.length === 0) {
    console.log('  ⚠️  No employees found, skipping time entries');
    return;
  }

  const now = new Date();
  let entryCount = 0;

  // Create time entries for the last 14 days
  for (let daysAgo = 14; daysAgo >= 0; daysAgo--) {
    const workDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
    const dayOfWeek = workDate.getDay();
    
    // Skip Sundays
    if (dayOfWeek === 0) continue;

    for (const employee of employees) {
      // 80% chance of working each day
      if (Math.random() > 0.8) continue;

      const clockIn = new Date(workDate);
      clockIn.setHours(8 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0);
      
      const clockOut = new Date(workDate);
      clockOut.setHours(17 + Math.floor(Math.random() * 2), Math.floor(Math.random() * 30), 0);

      const entryId = `00000000-0000-4000-8000-00000007${String(daysAgo).padStart(2, '0')}${String(employees.indexOf(employee)).padStart(2, '0')}`;

      await prisma.timeEntry.upsert({
        where: { id: entryId },
        update: {},
        create: {
          id: entryId,
          orgId: ORG_TAPAS_ID,
          userId: employee.id,
          branchId: BRANCH_TAPAS_MAIN_ID,
          clockInAt: clockIn,
          clockOutAt: daysAgo === 0 && clockOut > now ? null : clockOut, // Today might still be working
          method: 'MSR', // Magnetic Stripe Reader (badge swipe)
        },
      });

      entryCount++;
    }
  }

  console.log(`  ✅ Created ${entryCount} time entries`);
}

/**
 * Seed inventory for all branches
 */
async function seedInventory(prisma: PrismaClient): Promise<void> {
  console.log('\n📦 Seeding Inventory...');
  
  await seedTapasInventory(prisma);
  await seedCafesserieInventory(prisma);
  
  console.log('  ✅ Inventory seeded for all branches');
}

/**
 * Main function to seed all comprehensive demo data
 */
export async function seedComprehensive(prisma: PrismaClient): Promise<void> {
  // Safety check: only seed if explicitly enabled or not in production
  const shouldSeed =
    process.env.SEED_DEMO_DATA === 'true' ||
    process.env.NODE_ENV !== 'production';

  if (!shouldSeed) {
    console.log('\n⚠️  Skipping comprehensive seeding (production environment)');
    return;
  }

  console.log('\n📊 Seeding Comprehensive Demo Data...');

  try {
    await seedTables(prisma);
    await seedReservations(prisma);
    await seedSuppliers(prisma);
    await seedServiceProviders(prisma);
    await seedInventoryLocations(prisma); // NEW: Inventory locations for waste/receipts
    await seedInventoryPostingMappings(prisma); // NEW: GL posting mappings for inventory
    await seedInventory(prisma);          // NEW: Inventory items + stock batches
    await seedCompletedOrders(prisma);
    await seedLiveOrders(prisma);         // NEW: OPEN orders for POS
    await seedJournalEntries(prisma);
    await seedEmployeeProfiles(prisma);
    await seedTimeEntries(prisma);
    await seedEmployees(prisma);      // NEW: Employee records for StaffAward
    await seedStaffAwards(prisma);    // NEW: Monthly recognition
    await seedFeedback(prisma);       // NEW: Customer NPS feedback

    console.log('\n✅ Comprehensive demo data seeded successfully!');
  } catch (error) {
    console.error('❌ Comprehensive seeding failed:', error);
    throw error;
  }
}
