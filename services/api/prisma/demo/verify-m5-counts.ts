#!/usr/bin/env tsx
/**
 * M5 Verification: Count all operational data created by seedOperations
 */
import { prisma } from '@chefcloud/db';

const TAPAS_ORG_ID = '00000000-0000-4000-8000-000000000001';
const CAFESSERIE_ORG_ID = '00000000-0000-4000-8000-000000000002';

const TAPAS_BRANCH_ID = '00000000-0000-4000-8000-000000000101';
const CAF_VILLAGE_MALL_ID = '00000000-0000-4000-8000-000000000201';
const CAF_ACACIA_MALL_ID = '00000000-0000-4000-8000-000000000202';
const CAF_ARENA_MALL_ID = '00000000-0000-4000-8000-000000000203';
const CAF_MOMBASA_ID = '00000000-0000-4000-8000-000000000204';

async function getCounts() {
  console.log('\n═══════════════════════════════════════════');
  console.log('📊 M5 OPERATIONAL DATA VERIFICATION');
  console.log('═══════════════════════════════════════════\n');

  // ===== EMPLOYEES =====
  console.log('👥 EMPLOYEES & CONTRACTS\n');

  const tapasEmpCount = await prisma.employee.count({
    where: { orgId: TAPAS_ORG_ID },
  });
  const tapasActiveEmp = await prisma.employee.count({
    where: { orgId: TAPAS_ORG_ID, status: 'ACTIVE' },
  });
  const tapasTerminatedEmp = await prisma.employee.count({
    where: { orgId: TAPAS_ORG_ID, status: 'TERMINATED' },
  });
  const tapasContracts = await prisma.employmentContract.count({
    where: { orgId: TAPAS_ORG_ID },
  });

  console.log(`Tapas Bar & Restaurant:`);
  console.log(`  Total Employees: ${tapasEmpCount}`);
  console.log(`  - Active: ${tapasActiveEmp}`);
  console.log(`  - Terminated: ${tapasTerminatedEmp}`);
  console.log(`  Employment Contracts: ${tapasContracts}\n`);

  const cafOrgEmp = await prisma.employee.count({
    where: { orgId: CAFESSERIE_ORG_ID, branchId: null },
  });

  const cafVillageEmp = await prisma.employee.count({
    where: { branchId: CAF_VILLAGE_MALL_ID },
  });
  const cafAcaciaEmp = await prisma.employee.count({
    where: { branchId: CAF_ACACIA_MALL_ID },
  });
  const cafArenaEmp = await prisma.employee.count({
    where: { branchId: CAF_ARENA_MALL_ID },
  });
  const cafMombasaEmp = await prisma.employee.count({
    where: { branchId: CAF_MOMBASA_ID },
  });
  const cafTotalEmp = await prisma.employee.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });
  const cafActiveEmp = await prisma.employee.count({
    where: { orgId: CAFESSERIE_ORG_ID, status: 'ACTIVE' },
  });
  const cafContracts = await prisma.employmentContract.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });

  console.log(`Cafesserie:`);
  console.log(`  Org-Level Employees: ${cafOrgEmp}`);
  console.log(`  Village Mall: ${cafVillageEmp}`);
  console.log(`  Acacia Mall: ${cafAcaciaEmp}`);
  console.log(`  Arena Mall: ${cafArenaEmp}`);
  console.log(`  Mombasa: ${cafMombasaEmp}`);
  console.log(`  Total Employees: ${cafTotalEmp}`);
  console.log(`  - Active: ${cafActiveEmp}`);
  console.log(`  Employment Contracts: ${cafContracts}\n`);

  // ===== SERVICE PROVIDERS =====
  console.log('🏢 SERVICE PROVIDERS & CONTRACTS\n');

  const tapasProviders = await prisma.serviceProvider.count({
    where: { orgId: TAPAS_ORG_ID },
  });
  const tapasServiceContracts = await prisma.serviceContract.count({
    where: { provider: { orgId: TAPAS_ORG_ID } },
  });

  console.log(`Tapas Bar & Restaurant:`);
  console.log(`  Service Providers: ${tapasProviders}`);
  console.log(`  Service Contracts: ${tapasServiceContracts}\n`);

  const cafProviders = await prisma.serviceProvider.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });
  const cafServiceContracts = await prisma.serviceContract.count({
    where: { provider: { orgId: CAFESSERIE_ORG_ID } },
  });

  console.log(`Cafesserie:`);
  console.log(`  Service Providers: ${cafProviders}`);
  console.log(`  Service Contracts: ${cafServiceContracts}\n`);

  // ===== VENDORS & BILLS =====
  console.log('📦 VENDORS, BILLS & PAYMENTS\n');

  const tapasVendors = await prisma.vendor.count({
    where: { orgId: TAPAS_ORG_ID },
  });
  const tapasVendorBills = await prisma.vendorBill.count({
    where: { orgId: TAPAS_ORG_ID },
  });
  const tapasBillsPaid = await prisma.vendorBill.count({
    where: { orgId: TAPAS_ORG_ID, status: 'PAID' },
  });
  const tapasBillsOpen = await prisma.vendorBill.count({
    where: { orgId: TAPAS_ORG_ID, status: 'OPEN' },
  });
  const tapasPayments = await prisma.vendorPayment.count({
    where: { orgId: TAPAS_ORG_ID },
  });

  console.log(`Tapas Bar & Restaurant:`);
  console.log(`  Vendors: ${tapasVendors}`);
  console.log(`  Vendor Bills: ${tapasVendorBills}`);
  console.log(`  - Paid: ${tapasBillsPaid}`);
  console.log(`  - Open: ${tapasBillsOpen}`);
  console.log(`  Payments Recorded: ${tapasPayments}\n`);

  const cafVendors = await prisma.vendor.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });
  const cafVendorBills = await prisma.vendorBill.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });
  const cafBillsPaid = await prisma.vendorBill.count({
    where: { orgId: CAFESSERIE_ORG_ID, status: 'PAID' },
  });
  const cafBillsOpen = await prisma.vendorBill.count({
    where: { orgId: CAFESSERIE_ORG_ID, status: 'OPEN' },
  });
  const cafPayments = await prisma.vendorPayment.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });

  console.log(`Cafesserie:`);
  console.log(`  Vendors: ${cafVendors}`);
  console.log(`  Vendor Bills: ${cafVendorBills}`);
  console.log(`  - Paid: ${cafBillsPaid}`);
  console.log(`  - Open: ${cafBillsOpen}`);
  console.log(`  Payments Recorded: ${cafPayments}\n`);

  // ===== RESERVATIONS =====
  console.log('📅 RESERVATIONS (Tapas Only)\n');

  const tapasReservations = await prisma.reservation.count({
    where: { orgId: TAPAS_ORG_ID },
  });
  const tapasSeated = await prisma.reservation.count({
    where: { orgId: TAPAS_ORG_ID, status: 'SEATED' },
  });
  const tapasConfirmed = await prisma.reservation.count({
    where: { orgId: TAPAS_ORG_ID, status: 'CONFIRMED' },
  });
  const tapasCancelled = await prisma.reservation.count({
    where: { orgId: TAPAS_ORG_ID, status: 'CANCELLED' },
  });
  const tapasReservationReminders = await prisma.reservationReminder.count({
    where: { reservation: { orgId: TAPAS_ORG_ID } },
  });

  console.log(`Tapas Bar & Restaurant:`);
  console.log(`  Total Reservations: ${tapasReservations}`);
  console.log(`  - Seated: ${tapasSeated}`);
  console.log(`  - Confirmed: ${tapasConfirmed}`);
  console.log(`  - Cancelled: ${tapasCancelled}`);
  console.log(`  Reservation Reminders: ${tapasReservationReminders}\n`);

  // ===== FEEDBACK =====
  console.log('⭐ CUSTOMER FEEDBACK & NPS\n');

  const tapasFeedback = await prisma.feedback.count({
    where: { orgId: TAPAS_ORG_ID },
  });
  const tapasPromoters = await prisma.feedback.count({
    where: { orgId: TAPAS_ORG_ID, npsCategory: 'PROMOTER' },
  });
  const tapasPassive = await prisma.feedback.count({
    where: { orgId: TAPAS_ORG_ID, npsCategory: 'PASSIVE' },
  });
  const tapasDetractors = await prisma.feedback.count({
    where: { orgId: TAPAS_ORG_ID, npsCategory: 'DETRACTOR' },
  });
  const tapasAvgScore = await prisma.feedback.aggregate({
    where: { orgId: TAPAS_ORG_ID },
    _avg: { score: true },
  });

  console.log(`Tapas Bar & Restaurant:`);
  console.log(`  Total Feedback: ${tapasFeedback}`);
  console.log(`  - Promoters (9-10): ${tapasPromoters}`);
  console.log(`  - Passive (7-8): ${tapasPassive}`);
  console.log(`  - Detractors (0-6): ${tapasDetractors}`);
  console.log(`  Average Score: ${tapasAvgScore._avg.score?.toFixed(2) || 'N/A'}\n`);

  const cafFeedbackTotal = await prisma.feedback.count({
    where: { orgId: CAFESSERIE_ORG_ID },
  });
  const cafVillageFeedback = await prisma.feedback.count({
    where: { branchId: CAF_VILLAGE_MALL_ID },
  });
  const cafAcaciaFeedback = await prisma.feedback.count({
    where: { branchId: CAF_ACACIA_MALL_ID },
  });
  const cafArenaFeedback = await prisma.feedback.count({
    where: { branchId: CAF_ARENA_MALL_ID },
  });
  const cafMombasaFeedback = await prisma.feedback.count({
    where: { branchId: CAF_MOMBASA_ID },
  });

  const cafVillageAvg = await prisma.feedback.aggregate({
    where: { branchId: CAF_VILLAGE_MALL_ID },
    _avg: { score: true },
  });
  const cafAcaciaAvg = await prisma.feedback.aggregate({
    where: { branchId: CAF_ACACIA_MALL_ID },
    _avg: { score: true },
  });
  const cafArenaAvg = await prisma.feedback.aggregate({
    where: { branchId: CAF_ARENA_MALL_ID },
    _avg: { score: true },
  });
  const cafMombasaAvg = await prisma.feedback.aggregate({
    where: { branchId: CAF_MOMBASA_ID },
    _avg: { score: true },
  });
  const cafTotalAvg = await prisma.feedback.aggregate({
    where: { orgId: CAFESSERIE_ORG_ID },
    _avg: { score: true },
  });

  console.log(`Cafesserie:`);
  console.log(`  Total Feedback: ${cafFeedbackTotal}`);
  console.log(`  Village Mall: ${cafVillageFeedback} (avg: ${cafVillageAvg._avg.score?.toFixed(2) || 'N/A'})`);
  console.log(`  Acacia Mall: ${cafAcaciaFeedback} (avg: ${cafAcaciaAvg._avg.score?.toFixed(2) || 'N/A'})`);
  console.log(`  Arena Mall: ${cafArenaFeedback} (avg: ${cafArenaAvg._avg.score?.toFixed(2) || 'N/A'})`);
  console.log(`  Mombasa: ${cafMombasaFeedback} (avg: ${cafMombasaAvg._avg.score?.toFixed(2) || 'N/A'})`);
  console.log(`  Overall Average Score: ${cafTotalAvg._avg.score?.toFixed(2) || 'N/A'}\n`);

  console.log('═══════════════════════════════════════════\n');

  // Return structured data for comparison
  return {
    employees: {
      tapas: {
        total: tapasEmpCount,
        active: tapasActiveEmp,
        terminated: tapasTerminatedEmp,
        contracts: tapasContracts,
      },
      cafesserie: {
        orgLevel: cafOrgEmp,
        villageMall: cafVillageEmp,
        acaciaMall: cafAcaciaEmp,
        arenaMall: cafArenaEmp,
        mombasa: cafMombasaEmp,
        total: cafTotalEmp,
        active: cafActiveEmp,
        contracts: cafContracts,
      },
    },
    serviceProviders: {
      tapas: { providers: tapasProviders, contracts: tapasServiceContracts },
      cafesserie: { providers: cafProviders, contracts: cafServiceContracts },
    },
    vendors: {
      tapas: {
        vendors: tapasVendors,
        bills: tapasVendorBills,
        paid: tapasBillsPaid,
        open: tapasBillsOpen,
        payments: tapasPayments,
      },
      cafesserie: {
        vendors: cafVendors,
        bills: cafVendorBills,
        paid: cafBillsPaid,
        open: cafBillsOpen,
        payments: cafPayments,
      },
    },
    reservations: {
      tapas: {
        total: tapasReservations,
        seated: tapasSeated,
        confirmed: tapasConfirmed,
        cancelled: tapasCancelled,
        reminders: tapasReservationReminders,
      },
    },
    feedback: {
      tapas: {
        total: tapasFeedback,
        promoters: tapasPromoters,
        passive: tapasPassive,
        detractors: tapasDetractors,
        avgScore: parseFloat(tapasAvgScore._avg.score?.toFixed(2) || '0'),
      },
      cafesserie: {
        total: cafFeedbackTotal,
        villageMall: { count: cafVillageFeedback, avg: parseFloat(cafVillageAvg._avg.score?.toFixed(2) || '0') },
        acaciaMall: { count: cafAcaciaFeedback, avg: parseFloat(cafAcaciaAvg._avg.score?.toFixed(2) || '0') },
        arenaMall: { count: cafArenaFeedback, avg: parseFloat(cafArenaAvg._avg.score?.toFixed(2) || '0') },
        mombasa: { count: cafMombasaFeedback, avg: parseFloat(cafMombasaAvg._avg.score?.toFixed(2) || '0') },
        avgScore: parseFloat(cafTotalAvg._avg.score?.toFixed(2) || '0'),
      },
    },
  };
}

async function main() {
  const counts = await getCounts();
  await prisma.$disconnect();
  return counts;
}

if (require.main === module) {
  main()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('❌ Verification failed:', error);
      process.exit(1);
    });
}

export { getCounts };
