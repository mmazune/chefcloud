import { prisma } from '@chefcloud/db';
import { Decimal } from '@prisma/client/runtime/library';

// Demo org and branch IDs (Demo Restaurant - the org that owner@demo.local belongs to)
const DEMO_ORG_ID = 'cmjh5gyt2000012arpwsjwttf';
const MAIN_BRANCH_ID = 'main-branch';

// Get a random element from array
function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// Get random number between min and max
function randomBetween(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Generate random decimal for money amounts
function randomMoney(min: number, max: number): number {
  return Math.round((Math.random() * (max - min) + min) * 100) / 100;
}

async function seedAnomalyEvents() {
  console.log('🚨 Seeding anomaly/risk events...');

  // Get users for attribution
  const users = await prisma.user.findMany({
    where: { orgId: DEMO_ORG_ID },
    select: { id: true, firstName: true },
    take: 10,
  });

  // Get orders for linking
  const orders = await prisma.order.findMany({
    where: { branchId: MAIN_BRANCH_ID },
    select: { id: true, branchId: true },
    take: 50,
  });

  const branches = [MAIN_BRANCH_ID];
  const anomalyTypes = ['NO_DRINKS', 'LATE_VOID', 'HEAVY_DISCOUNT', 'VOID_SPIKE'];
  const severities = ['INFO', 'WARN', 'CRITICAL'];

  const anomalies: any[] = [];
  const now = new Date();

  // Generate 60 anomalies spread over the last 30 days
  for (let i = 0; i < 60; i++) {
    const daysAgo = randomBetween(0, 29);
    const hoursAgo = randomBetween(0, 23);
    const occurredAt = new Date(now);
    occurredAt.setDate(occurredAt.getDate() - daysAgo);
    occurredAt.setHours(hoursAgo, randomBetween(0, 59), randomBetween(0, 59));

    const type = randomChoice(anomalyTypes);
    const branch = randomChoice(branches);
    const user = users.length > 0 ? randomChoice(users) : null;
    const order = orders.length > 0 ? randomChoice(orders) : null;

    // Assign severity based on type
    let severity: string;
    if (type === 'VOID_SPIKE') {
      severity = randomChoice(['WARN', 'CRITICAL']);
    } else if (type === 'HEAVY_DISCOUNT') {
      severity = randomChoice(['WARN', 'CRITICAL', 'CRITICAL']);
    } else if (type === 'LATE_VOID') {
      severity = randomChoice(['INFO', 'WARN', 'CRITICAL']);
    } else {
      severity = randomChoice(['INFO', 'INFO', 'WARN']);
    }

    // Generate details based on type
    let details: any = {};
    switch (type) {
      case 'NO_DRINKS':
        details = {
          orderTotal: randomMoney(25000, 150000),
          itemCount: randomBetween(3, 8),
          reason: 'Order had no beverage items',
        };
        break;
      case 'LATE_VOID':
        details = {
          voidedAmount: randomMoney(10000, 80000),
          minutesAfterOrder: randomBetween(15, 120),
          itemName: randomChoice(['Grilled Chicken', 'Pizza Margherita', 'Beef Steak', 'Pasta']),
        };
        break;
      case 'HEAVY_DISCOUNT':
        details = {
          originalAmount: randomMoney(50000, 200000),
          discountPercent: randomBetween(30, 70),
          discountAmount: randomMoney(15000, 100000),
          reason: randomChoice(['Manager override', 'Customer complaint', 'Staff meal', 'VIP discount']),
        };
        break;
      case 'VOID_SPIKE':
        details = {
          voidCount: randomBetween(5, 15),
          voidTotal: randomMoney(50000, 250000),
          periodMinutes: 60,
          threshold: 3,
        };
        break;
    }

    anomalies.push({
      orgId: DEMO_ORG_ID,
      branchId: branch,
      userId: user?.id || null,
      orderId: order?.id || null,
      type,
      severity,
      details,
      occurredAt,
    });
  }

  // Delete existing anomalies for this org
  await prisma.anomalyEvent.deleteMany({
    where: { orgId: DEMO_ORG_ID },
  });

  // Insert new anomalies
  await prisma.anomalyEvent.createMany({
    data: anomalies,
  });

  // Count by severity for summary
  const critical = anomalies.filter((a) => a.severity === 'CRITICAL').length;
  const warn = anomalies.filter((a) => a.severity === 'WARN').length;
  const info = anomalies.filter((a) => a.severity === 'INFO').length;

  console.log(`  ✅ Created ${anomalies.length} anomaly events`);
  console.log(`     - Critical: ${critical}, Warning: ${warn}, Info: ${info}`);
}

async function seedShifts() {
  console.log('⏰ Seeding shift data...');

  // Get users who can open/close shifts
  const users = await prisma.user.findMany({
    where: { orgId: DEMO_ORG_ID },
    select: { id: true, firstName: true },
    take: 10,
  });

  if (users.length < 2) {
    console.log('  ⚠️ Not enough users to seed shifts');
    return;
  }

  const branches = [
    { id: MAIN_BRANCH_ID, name: 'Main Branch' },
  ];

  const shifts: any[] = [];
  const now = new Date();

  // Generate shifts for the last 30 days, 2 shifts per day per branch
  for (let daysAgo = 0; daysAgo < 30; daysAgo++) {
    for (const branch of branches) {
      // Morning shift: 8am - 4pm
      const morningOpen = new Date(now);
      morningOpen.setDate(morningOpen.getDate() - daysAgo);
      morningOpen.setHours(8, 0, 0, 0);

      const morningClose = new Date(morningOpen);
      morningClose.setHours(16, randomBetween(0, 30), 0, 0);

      const morningOpener = randomChoice(users);
      const morningCloser = randomChoice(users);
      const morningFloat = randomMoney(500000, 1000000);
      const morningDeclared = morningFloat + randomMoney(800000, 2500000);
      const morningOverShort = randomMoney(-20000, 15000);

      shifts.push({
        orgId: DEMO_ORG_ID,
        branchId: branch.id,
        openedById: morningOpener.id,
        closedById: daysAgo === 0 ? null : morningCloser.id, // Today's shift still open
        openedAt: morningOpen,
        closedAt: daysAgo === 0 ? null : morningClose,
        openingFloat: new Decimal(morningFloat),
        declaredCash: daysAgo === 0 ? null : new Decimal(morningDeclared),
        overShort: daysAgo === 0 ? null : new Decimal(morningOverShort),
        notes: daysAgo === 0 ? null : `Morning shift - ${branch.name}`,
        metadata: {
          salesCount: randomBetween(25, 60),
          totalSales: randomMoney(1500000, 4000000),
          cardPayments: randomMoney(500000, 1500000),
          mobilePayments: randomMoney(200000, 800000),
        },
      });

      // Evening shift: 4pm - 11pm (only for past days)
      if (daysAgo > 0) {
        const eveningOpen = new Date(morningClose);
        eveningOpen.setHours(16, 30, 0, 0);

        const eveningClose = new Date(eveningOpen);
        eveningClose.setHours(23, randomBetween(0, 30), 0, 0);

        const eveningOpener = randomChoice(users);
        const eveningCloser = randomChoice(users);
        const eveningFloat = randomMoney(500000, 1000000);
        const eveningDeclared = eveningFloat + randomMoney(1200000, 3500000);
        const eveningOverShort = randomMoney(-25000, 20000);

        shifts.push({
          orgId: DEMO_ORG_ID,
          branchId: branch.id,
          openedById: eveningOpener.id,
          closedById: eveningCloser.id,
          openedAt: eveningOpen,
          closedAt: eveningClose,
          openingFloat: new Decimal(eveningFloat),
          declaredCash: new Decimal(eveningDeclared),
          overShort: new Decimal(eveningOverShort),
          notes: `Evening shift - ${branch.name}`,
          metadata: {
            salesCount: randomBetween(35, 80),
            totalSales: randomMoney(2000000, 5000000),
            cardPayments: randomMoney(800000, 2000000),
            mobilePayments: randomMoney(400000, 1200000),
          },
        });
      }
    }
  }

  // Delete existing shifts for this org
  await prisma.shift.deleteMany({
    where: { orgId: DEMO_ORG_ID },
  });

  // Insert new shifts
  for (const shift of shifts) {
    await prisma.shift.create({
      data: shift,
    });
  }

  console.log(`  ✅ Created ${shifts.length} shifts`);
  console.log(`     - Open shifts (today): ${shifts.filter((s) => !s.closedAt).length}`);
  console.log(`     - Closed shifts: ${shifts.filter((s) => s.closedAt).length}`);
}

async function seedTillSessions() {
  console.log('💵 Seeding till sessions...');

  // Get shifts
  const shifts = await prisma.shift.findMany({
    where: { orgId: DEMO_ORG_ID },
    select: { id: true, branchId: true, openedById: true, closedById: true, closedAt: true },
    orderBy: { openedAt: 'desc' },
    take: 50,
  });

  const tillSessions: any[] = [];

  for (const shift of shifts) {
    const openFloat = randomMoney(200000, 500000);
    const expectedCash = openFloat + randomMoney(500000, 2000000);
    const countedCash = expectedCash + randomMoney(-10000, 8000);
    const variance = countedCash - expectedCash;

    tillSessions.push({
      orgId: DEMO_ORG_ID,
      branchId: shift.branchId,
      shiftId: shift.id,
      openedById: shift.openedById,
      closedById: shift.closedById,
      closedAt: shift.closedAt,
      openFloat: new Decimal(openFloat),
      expectedCash: shift.closedAt ? new Decimal(expectedCash) : null,
      countedCash: shift.closedAt ? new Decimal(countedCash) : null,
      variance: shift.closedAt ? new Decimal(variance) : null,
      status: shift.closedAt ? 'CLOSED' : 'OPEN',
    });
  }

  // Delete existing till sessions for this org
  await prisma.tillSession.deleteMany({
    where: { orgId: DEMO_ORG_ID },
  });

  // Insert new till sessions
  for (const session of tillSessions) {
    await prisma.tillSession.create({
      data: session,
    });
  }

  console.log(`  ✅ Created ${tillSessions.length} till sessions`);
}

async function main() {
  console.log('🚀 Starting risk and shift data seed...\n');

  try {
    await seedAnomalyEvents();
    await seedShifts();
    // Skip till sessions for now - requires drawer setup
    // await seedTillSessions();

    console.log('\n✅ All risk and shift data seeded successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();

