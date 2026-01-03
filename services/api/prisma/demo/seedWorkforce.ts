/**
 * M10.2: Workforce Demo Seeding
 *
 * Seeds deterministic workforce data:
 * - Tapas: 6 shifts, 4 time entries, 2 breaks, 6 audit logs
 * - Cafesserie: 12 shifts, 8 time entries, 4 breaks, 12 audit logs
 *
 * All IDs are deterministic for idempotent seeding.
 */

import { PrismaClient, ShiftStatus, TimeClockMethod } from '@prisma/client';
import {
  ORG_TAPAS_ID,
  ORG_CAFESSERIE_ID,
  BRANCH_TAPAS_MAIN_ID,
  BRANCH_CAFE_VILLAGE_MALL_ID,
  BRANCH_CAFE_ACACIA_MALL_ID,
  BRANCH_CAFE_ARENA_MALL_ID,
  BRANCH_CAFE_MOMBASA_ID,
} from './constants';

// ===== Deterministic IDs =====
// Scheduled Shifts
const SHIFT_TAPAS_1 = '00000000-0000-4000-8000-001000000001';
const SHIFT_TAPAS_2 = '00000000-0000-4000-8000-001000000002';
const SHIFT_TAPAS_3 = '00000000-0000-4000-8000-001000000003';
const SHIFT_TAPAS_4 = '00000000-0000-4000-8000-001000000004';
const SHIFT_TAPAS_5 = '00000000-0000-4000-8000-001000000005';
const SHIFT_TAPAS_6 = '00000000-0000-4000-8000-001000000006';

const SHIFT_CAFE_1 = '00000000-0000-4000-8000-001000000101';
const SHIFT_CAFE_2 = '00000000-0000-4000-8000-001000000102';
const SHIFT_CAFE_3 = '00000000-0000-4000-8000-001000000103';
const SHIFT_CAFE_4 = '00000000-0000-4000-8000-001000000104';
const SHIFT_CAFE_5 = '00000000-0000-4000-8000-001000000105';
const SHIFT_CAFE_6 = '00000000-0000-4000-8000-001000000106';
const SHIFT_CAFE_7 = '00000000-0000-4000-8000-001000000107';
const SHIFT_CAFE_8 = '00000000-0000-4000-8000-001000000108';
const SHIFT_CAFE_9 = '00000000-0000-4000-8000-001000000109';
const SHIFT_CAFE_10 = '00000000-0000-4000-8000-001000000110';
const SHIFT_CAFE_11 = '00000000-0000-4000-8000-001000000111';
const SHIFT_CAFE_12 = '00000000-0000-4000-8000-001000000112';

// Time Entries (workforce-linked)
const TIME_ENTRY_TAPAS_1 = '00000000-0000-4000-8000-001100000001';
const TIME_ENTRY_TAPAS_2 = '00000000-0000-4000-8000-001100000002';
const TIME_ENTRY_TAPAS_3 = '00000000-0000-4000-8000-001100000003';
const TIME_ENTRY_TAPAS_4 = '00000000-0000-4000-8000-001100000004';

const TIME_ENTRY_CAFE_1 = '00000000-0000-4000-8000-001100000101';
const TIME_ENTRY_CAFE_2 = '00000000-0000-4000-8000-001100000102';
const TIME_ENTRY_CAFE_3 = '00000000-0000-4000-8000-001100000103';
const TIME_ENTRY_CAFE_4 = '00000000-0000-4000-8000-001100000104';
const TIME_ENTRY_CAFE_5 = '00000000-0000-4000-8000-001100000105';
const TIME_ENTRY_CAFE_6 = '00000000-0000-4000-8000-001100000106';
const TIME_ENTRY_CAFE_7 = '00000000-0000-4000-8000-001100000107';
const TIME_ENTRY_CAFE_8 = '00000000-0000-4000-8000-001100000108';

// Break Entries
const BREAK_TAPAS_1 = '00000000-0000-4000-8000-001200000001';
const BREAK_TAPAS_2 = '00000000-0000-4000-8000-001200000002';
const BREAK_CAFE_1 = '00000000-0000-4000-8000-001200000101';
const BREAK_CAFE_2 = '00000000-0000-4000-8000-001200000102';
const BREAK_CAFE_3 = '00000000-0000-4000-8000-001200000103';
const BREAK_CAFE_4 = '00000000-0000-4000-8000-001200000104';

// Audit Logs
const AUDIT_TAPAS_1 = '00000000-0000-4000-8000-001300000001';
const AUDIT_TAPAS_2 = '00000000-0000-4000-8000-001300000002';
const AUDIT_TAPAS_3 = '00000000-0000-4000-8000-001300000003';
const AUDIT_TAPAS_4 = '00000000-0000-4000-8000-001300000004';
const AUDIT_TAPAS_5 = '00000000-0000-4000-8000-001300000005';
const AUDIT_TAPAS_6 = '00000000-0000-4000-8000-001300000006';

const AUDIT_CAFE_1 = '00000000-0000-4000-8000-001300000101';
const AUDIT_CAFE_2 = '00000000-0000-4000-8000-001300000102';
const AUDIT_CAFE_3 = '00000000-0000-4000-8000-001300000103';
const AUDIT_CAFE_4 = '00000000-0000-4000-8000-001300000104';
const AUDIT_CAFE_5 = '00000000-0000-4000-8000-001300000105';
const AUDIT_CAFE_6 = '00000000-0000-4000-8000-001300000106';
const AUDIT_CAFE_7 = '00000000-0000-4000-8000-001300000107';
const AUDIT_CAFE_8 = '00000000-0000-4000-8000-001300000108';
const AUDIT_CAFE_9 = '00000000-0000-4000-8000-001300000109';
const AUDIT_CAFE_10 = '00000000-0000-4000-8000-001300000110';
const AUDIT_CAFE_11 = '00000000-0000-4000-8000-001300000111';
const AUDIT_CAFE_12 = '00000000-0000-4000-8000-001300000112';

/**
 * Clean up old workforce data before reseeding
 */
async function cleanupWorkforceData(prisma: PrismaClient): Promise<void> {
  console.log('  🧹 Cleaning up old workforce demo data...');
  
  const demoOrgIds = [ORG_TAPAS_ID, ORG_CAFESSERIE_ID];

  // Delete in correct order due to FK constraints
  await prisma.breakEntry.deleteMany({
    where: { timeEntry: { orgId: { in: demoOrgIds } } },
  });
  
  await prisma.workforceAuditLog.deleteMany({
    where: { orgId: { in: demoOrgIds } },
  });
  
  // Delete TimeEntries with shiftId (workforce-linked)
  await prisma.timeEntry.deleteMany({
    where: { 
      orgId: { in: demoOrgIds },
      shiftId: { not: null },
    },
  });
  
  await prisma.scheduledShift.deleteMany({
    where: { orgId: { in: demoOrgIds } },
  });

  console.log('  ✅ Workforce data cleanup complete');
}

/**
 * Get user IDs by email for the given org
 */
async function getUserIdsByEmail(
  prisma: PrismaClient,
  orgId: string,
): Promise<Record<string, string>> {
  const users = await prisma.user.findMany({
    where: { orgId },
    select: { id: true, email: true },
  });
  return users.reduce((acc, u) => {
    acc[u.email] = u.id;
    return acc;
  }, {} as Record<string, string>);
}

/**
 * Seed workforce data for Tapas
 */
async function seedTapasWorkforce(prisma: PrismaClient): Promise<void> {
  console.log('  📅 Seeding Tapas workforce data...');
  
  const usersByEmail = await getUserIdsByEmail(prisma, ORG_TAPAS_ID);
  const managerId = usersByEmail['manager@tapas.demo.local'];
  const cashierId = usersByEmail['cashier@tapas.demo.local'];
  const waiterId = usersByEmail['waiter@tapas.demo.local'];
  const chefId = usersByEmail['chef@tapas.demo.local'];
  
  if (!managerId || !cashierId || !waiterId || !chefId) {
    console.log('  ⚠️ Missing Tapas users, skipping workforce seed');
    return;
  }

  // Dates: use relative to "today" for demo freshness
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dayAfter = new Date(today);
  dayAfter.setDate(dayAfter.getDate() + 2);

  // Create 6 scheduled shifts
  await prisma.scheduledShift.createMany({
    data: [
      // 2 DRAFT (future)
      {
        id: SHIFT_TAPAS_1,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: waiterId,
        role: 'WAITER',
        startAt: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000), // 9 AM
        endAt: new Date(tomorrow.getTime() + 17 * 60 * 60 * 1000), // 5 PM
        plannedMinutes: 480,
        status: ShiftStatus.DRAFT,
      },
      {
        id: SHIFT_TAPAS_2,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: chefId,
        role: 'CHEF',
        startAt: new Date(dayAfter.getTime() + 8 * 60 * 60 * 1000), // 8 AM
        endAt: new Date(dayAfter.getTime() + 16 * 60 * 60 * 1000), // 4 PM
        plannedMinutes: 480,
        status: ShiftStatus.DRAFT,
      },
      // 2 PUBLISHED (today and tomorrow)
      {
        id: SHIFT_TAPAS_3,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: cashierId,
        role: 'CASHIER',
        startAt: new Date(today.getTime() + 10 * 60 * 60 * 1000), // 10 AM
        endAt: new Date(today.getTime() + 18 * 60 * 60 * 1000), // 6 PM
        plannedMinutes: 480,
        status: ShiftStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: managerId,
      },
      {
        id: SHIFT_TAPAS_4,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: waiterId,
        role: 'WAITER',
        startAt: new Date(today.getTime() + 12 * 60 * 60 * 1000), // 12 PM
        endAt: new Date(today.getTime() + 20 * 60 * 60 * 1000), // 8 PM
        plannedMinutes: 480,
        status: ShiftStatus.PUBLISHED,
        publishedAt: new Date(),
        publishedById: managerId,
      },
      // 1 COMPLETED (yesterday)
      {
        id: SHIFT_TAPAS_5,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: cashierId,
        role: 'CASHIER',
        startAt: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000),
        endAt: new Date(yesterday.getTime() + 17 * 60 * 60 * 1000),
        plannedMinutes: 480,
        actualMinutes: 485,
        breakMinutes: 30,
        overtimeMinutes: 5,
        status: ShiftStatus.COMPLETED,
        publishedAt: yesterday,
        publishedById: managerId,
      },
      // 1 APPROVED (yesterday)
      {
        id: SHIFT_TAPAS_6,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: chefId,
        role: 'CHEF',
        startAt: new Date(yesterday.getTime() + 8 * 60 * 60 * 1000),
        endAt: new Date(yesterday.getTime() + 16 * 60 * 60 * 1000),
        plannedMinutes: 480,
        actualMinutes: 480,
        breakMinutes: 30,
        overtimeMinutes: 0,
        status: ShiftStatus.APPROVED,
        publishedAt: yesterday,
        publishedById: managerId,
        approvedAt: new Date(),
        approvedById: managerId,
      },
    ],
    skipDuplicates: true,
  });

  // Create 4 time entries (2 complete, 2 in-progress)
  await prisma.timeEntry.createMany({
    data: [
      // Complete entries (yesterday)
      {
        id: TIME_ENTRY_TAPAS_1,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: cashierId,
        shiftId: SHIFT_TAPAS_5,
        clockInAt: new Date(yesterday.getTime() + 9 * 60 * 60 * 1000),
        clockOutAt: new Date(yesterday.getTime() + 17 * 60 * 60 * 1000 + 5 * 60 * 1000),
        method: TimeClockMethod.PASSWORD,
        approved: true,
        approvedById: managerId,
        overtimeMinutes: 5,
      },
      {
        id: TIME_ENTRY_TAPAS_2,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: chefId,
        shiftId: SHIFT_TAPAS_6,
        clockInAt: new Date(yesterday.getTime() + 8 * 60 * 60 * 1000),
        clockOutAt: new Date(yesterday.getTime() + 16 * 60 * 60 * 1000),
        method: TimeClockMethod.PASSWORD,
        approved: true,
        approvedById: managerId,
        overtimeMinutes: 0,
      },
      // In-progress entries (today)
      {
        id: TIME_ENTRY_TAPAS_3,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: cashierId,
        shiftId: SHIFT_TAPAS_3,
        clockInAt: new Date(today.getTime() + 10 * 60 * 60 * 1000),
        clockOutAt: null,
        method: TimeClockMethod.PASSWORD,
        approved: false,
        overtimeMinutes: 0,
      },
      {
        id: TIME_ENTRY_TAPAS_4,
        orgId: ORG_TAPAS_ID,
        branchId: BRANCH_TAPAS_MAIN_ID,
        userId: waiterId,
        shiftId: SHIFT_TAPAS_4,
        clockInAt: new Date(today.getTime() + 12 * 60 * 60 * 1000),
        clockOutAt: null,
        method: TimeClockMethod.PASSWORD,
        approved: false,
        overtimeMinutes: 0,
      },
    ],
    skipDuplicates: true,
  });

  // Create 2 break entries (on completed time entries)
  await prisma.breakEntry.createMany({
    data: [
      {
        id: BREAK_TAPAS_1,
        timeEntryId: TIME_ENTRY_TAPAS_1,
        startedAt: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000),
        endedAt: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000 + 30 * 60 * 1000),
        minutes: 30,
      },
      {
        id: BREAK_TAPAS_2,
        timeEntryId: TIME_ENTRY_TAPAS_2,
        startedAt: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000),
        endedAt: new Date(yesterday.getTime() + 12 * 60 * 60 * 1000 + 30 * 60 * 1000),
        minutes: 30,
      },
    ],
    skipDuplicates: true,
  });

  // Create 6 audit logs
  await prisma.workforceAuditLog.createMany({
    data: [
      {
        id: AUDIT_TAPAS_1,
        orgId: ORG_TAPAS_ID,
        action: 'SHIFT_CREATED',
        entityType: 'ScheduledShift',
        entityId: SHIFT_TAPAS_5,
        performedById: managerId,
        payload: { role: 'CASHIER' },
      },
      {
        id: AUDIT_TAPAS_2,
        orgId: ORG_TAPAS_ID,
        action: 'SHIFT_PUBLISHED',
        entityType: 'ScheduledShift',
        entityId: SHIFT_TAPAS_5,
        performedById: managerId,
        payload: { status: 'PUBLISHED' },
      },
      {
        id: AUDIT_TAPAS_3,
        orgId: ORG_TAPAS_ID,
        action: 'CLOCK_IN',
        entityType: 'TimeEntry',
        entityId: TIME_ENTRY_TAPAS_1,
        performedById: cashierId,
        payload: { shiftId: SHIFT_TAPAS_5 },
      },
      {
        id: AUDIT_TAPAS_4,
        orgId: ORG_TAPAS_ID,
        action: 'BREAK_START',
        entityType: 'BreakEntry',
        entityId: BREAK_TAPAS_1,
        performedById: cashierId,
        payload: { timeEntryId: TIME_ENTRY_TAPAS_1 },
      },
      {
        id: AUDIT_TAPAS_5,
        orgId: ORG_TAPAS_ID,
        action: 'BREAK_END',
        entityType: 'BreakEntry',
        entityId: BREAK_TAPAS_1,
        performedById: cashierId,
        payload: { minutes: 30 },
      },
      {
        id: AUDIT_TAPAS_6,
        orgId: ORG_TAPAS_ID,
        action: 'CLOCK_OUT',
        entityType: 'TimeEntry',
        entityId: TIME_ENTRY_TAPAS_1,
        performedById: cashierId,
        payload: { overtimeMinutes: 5 },
      },
    ],
    skipDuplicates: true,
  });

  console.log('  ✅ Tapas workforce: 6 shifts, 4 entries, 2 breaks, 6 audit logs');
}

/**
 * Seed workforce data for Cafesserie (4 branches)
 */
async function seedCafesserieWorkforce(prisma: PrismaClient): Promise<void> {
  console.log('  📅 Seeding Cafesserie workforce data...');
  
  const usersByEmail = await getUserIdsByEmail(prisma, ORG_CAFESSERIE_ID);
  const managerId = usersByEmail['manager@cafesserie.demo.local'];
  const supervisorId = usersByEmail['supervisor@cafesserie.demo.local'];
  const cashierId = usersByEmail['cashier@cafesserie.demo.local'];
  const waiterId = usersByEmail['waiter@cafesserie.demo.local'];
  const chefId = usersByEmail['chef@cafesserie.demo.local'];
  
  if (!managerId || !supervisorId || !cashierId || !waiterId) {
    console.log('  ⚠️ Missing Cafesserie users, skipping workforce seed');
    return;
  }

  const branches = [
    BRANCH_CAFE_VILLAGE_MALL_ID,
    BRANCH_CAFE_ACACIA_MALL_ID,
    BRANCH_CAFE_ARENA_MALL_ID,
    BRANCH_CAFE_MOMBASA_ID,
  ];

  const shiftIds = [
    SHIFT_CAFE_1, SHIFT_CAFE_2, SHIFT_CAFE_3, SHIFT_CAFE_4,
    SHIFT_CAFE_5, SHIFT_CAFE_6, SHIFT_CAFE_7, SHIFT_CAFE_8,
    SHIFT_CAFE_9, SHIFT_CAFE_10, SHIFT_CAFE_11, SHIFT_CAFE_12,
  ];

  const timeEntryIds = [
    TIME_ENTRY_CAFE_1, TIME_ENTRY_CAFE_2, TIME_ENTRY_CAFE_3, TIME_ENTRY_CAFE_4,
    TIME_ENTRY_CAFE_5, TIME_ENTRY_CAFE_6, TIME_ENTRY_CAFE_7, TIME_ENTRY_CAFE_8,
  ];

  const breakIds = [BREAK_CAFE_1, BREAK_CAFE_2, BREAK_CAFE_3, BREAK_CAFE_4];

  const auditIds = [
    AUDIT_CAFE_1, AUDIT_CAFE_2, AUDIT_CAFE_3, AUDIT_CAFE_4,
    AUDIT_CAFE_5, AUDIT_CAFE_6, AUDIT_CAFE_7, AUDIT_CAFE_8,
    AUDIT_CAFE_9, AUDIT_CAFE_10, AUDIT_CAFE_11, AUDIT_CAFE_12,
  ];

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  const users = [cashierId, waiterId, chefId || supervisorId];
  const roles = ['CASHIER', 'WAITER', 'CHEF'];
  const statuses = [ShiftStatus.DRAFT, ShiftStatus.PUBLISHED, ShiftStatus.COMPLETED];

  // Create 12 shifts (3 per branch)
  const shifts = branches.flatMap((branchId, branchIdx) =>
    statuses.map((status, statusIdx) => ({
      id: shiftIds[branchIdx * 3 + statusIdx],
      orgId: ORG_CAFESSERIE_ID,
      branchId,
      userId: users[statusIdx % users.length]!,
      role: roles[statusIdx % roles.length],
      startAt: new Date(
        (status === ShiftStatus.COMPLETED ? yesterday : today).getTime() +
          (9 + statusIdx) * 60 * 60 * 1000,
      ),
      endAt: new Date(
        (status === ShiftStatus.COMPLETED ? yesterday : today).getTime() +
          (17 + statusIdx) * 60 * 60 * 1000,
      ),
      plannedMinutes: 480,
      actualMinutes: status === ShiftStatus.COMPLETED ? 485 : null,
      breakMinutes: status === ShiftStatus.COMPLETED ? 30 : null,
      overtimeMinutes: status === ShiftStatus.COMPLETED ? 5 : null,
      status,
      publishedAt:
        status !== ShiftStatus.DRAFT ? yesterday : null,
      publishedById:
        status !== ShiftStatus.DRAFT ? managerId : null,
    })),
  );

  await prisma.scheduledShift.createMany({
    data: shifts,
    skipDuplicates: true,
  });

  // Create 8 time entries (2 per branch)
  const completedShifts = shifts.filter((s) => s.status === ShiftStatus.COMPLETED);
  const publishedShifts = shifts.filter((s) => s.status === ShiftStatus.PUBLISHED);

  const timeEntries = [
    ...completedShifts.map((shift, idx) => ({
      id: timeEntryIds[idx],
      orgId: ORG_CAFESSERIE_ID,
      branchId: shift.branchId,
      userId: shift.userId,
      shiftId: shift.id,
      clockInAt: shift.startAt,
      clockOutAt: new Date(shift.endAt.getTime() + 5 * 60 * 1000),
      method: TimeClockMethod.PASSWORD,
      approved: true,
      approvedById: managerId,
      overtimeMinutes: 5,
    })),
    ...publishedShifts.slice(0, 4).map((shift, idx) => ({
      id: timeEntryIds[completedShifts.length + idx],
      orgId: ORG_CAFESSERIE_ID,
      branchId: shift.branchId,
      userId: shift.userId,
      shiftId: shift.id,
      clockInAt: shift.startAt,
      clockOutAt: null,
      method: TimeClockMethod.PASSWORD,
      approved: false,
      overtimeMinutes: 0,
    })),
  ];

  await prisma.timeEntry.createMany({
    data: timeEntries,
    skipDuplicates: true,
  });

  // Create 4 breaks (on completed entries)
  const completedEntries = timeEntries.filter((e) => e.clockOutAt !== null);
  await prisma.breakEntry.createMany({
    data: completedEntries.map((entry, idx) => ({
      id: breakIds[idx],
      timeEntryId: entry.id,
      startedAt: new Date(entry.clockInAt.getTime() + 3 * 60 * 60 * 1000),
      endedAt: new Date(entry.clockInAt.getTime() + 3 * 60 * 60 * 1000 + 30 * 60 * 1000),
      minutes: 30,
    })),
    skipDuplicates: true,
  });

  // Create 12 audit logs
  const auditActions = [
    'SHIFT_CREATED',
    'SHIFT_PUBLISHED',
    'CLOCK_IN',
    'BREAK_START',
    'BREAK_END',
    'CLOCK_OUT',
    'SHIFT_CREATED',
    'SHIFT_PUBLISHED',
    'CLOCK_IN',
    'BREAK_START',
    'BREAK_END',
    'CLOCK_OUT',
  ];

  await prisma.workforceAuditLog.createMany({
    data: auditIds.map((id, idx) => ({
      id,
      orgId: ORG_CAFESSERIE_ID,
      action: auditActions[idx],
      entityType: idx % 3 === 0 ? 'ScheduledShift' : idx % 3 === 1 ? 'TimeEntry' : 'BreakEntry',
      entityId: shiftIds[idx % shiftIds.length],
      performedById: idx % 2 === 0 ? managerId : cashierId,
      payload: { index: idx },
    })),
    skipDuplicates: true,
  });

  console.log('  ✅ Cafesserie workforce: 12 shifts, 8 entries, 4 breaks, 12 audit logs');
}

/**
 * Main seed function for workforce data
 */
export async function seedWorkforce(prisma: PrismaClient): Promise<void> {
  console.log('\n🔧 M10.2: Seeding workforce data...');

  await cleanupWorkforceData(prisma);
  await seedTapasWorkforce(prisma);
  await seedCafesserieWorkforce(prisma);

  console.log('✅ Workforce seeding complete\n');
}
