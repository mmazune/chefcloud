/**
 * M33-DEMO-S4: Tapas Demo Reset Script
 * 
 * Resets the Tapas demo org data to a clean, deterministic state.
 * 
 * This script:
 * 1. Locates the Tapas demo org by slug (from DEMO_TAPAS_ORG_SLUG env)
 * 2. Deletes all dynamic/operational data tied to that org
 * 3. Preserves static data (org, branches, users, menu, inventory)
 * 4. Re-runs the Tapas data seed to recreate the 30-day demo window
 * 
 * Usage:
 *   pnpm --filter @chefcloud/api demo:reset:tapas
 * 
 * Safety:
 * - Only operates on orgs with isDemo=true AND matching slug
 * - Multi-tenant safe - will never affect real customer orgs
 */

import { PrismaClient } from '@prisma/client';
import { seedTapasDemoData } from './tapas/seed-tapas-data';

const prisma = new PrismaClient();

async function main() {
  const demoSlug = process.env.DEMO_TAPAS_ORG_SLUG ?? 'tapas-demo';
  
  console.log(`🔍 Looking for Tapas demo org: ${demoSlug}...`);
  
  const org = await prisma.org.findUnique({
    where: { slug: demoSlug },
    include: { branches: true },
  });

  if (!org) {
    console.error(`❌ Tapas demo org '${demoSlug}' not found.`);
    console.log('Run the seed script first: pnpm --filter @chefcloud/db db:seed');
    process.exit(1);
  }

  if (!org.isDemo) {
    console.error(`❌ Org '${org.slug}' is not a demo org (isDemo=false).`);
    console.error('This script only operates on demo orgs for safety.');
    process.exit(1);
  }

  console.log(`✅ Found Tapas demo org: ${org.name} (${org.id})`);
  console.log(`📋 Branches: ${org.branches.map((b) => b.name).join(', ')}`);
  console.log('');

  console.log('🗑️  Deleting dynamic/operational data...');

  // Get branch IDs for cascading deletes
  const branchIds = org.branches.map((b) => b.id);

  // M33-DEMO-S4: Delete all operational data scoped by orgId
  // NOTE: Adjust table names to match your actual Prisma schema
  
  // Orders & Payments
  await prisma.payment.deleteMany({ where: { orgId: org.id } });
  await prisma.order.deleteMany({ where: { orgId: org.id } });
  
  // KDS
  await prisma.kdsTicket.deleteMany({ where: { orgId: org.id } });
  
  // Inventory movements & wastage
  await prisma.wastage.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.stockMovement.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.goodsReceipt.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.purchaseOrder.deleteMany({ where: { branchId: { in: branchIds } } });
  
  // Budgets & Forecasts
  await prisma.branchBudget.deleteMany({ where: { orgId: org.id } });
  await prisma.franchiseBudget.deleteMany({ where: { orgId: org.id } });
  await prisma.forecastPoint.deleteMany({ where: { orgId: org.id } });
  
  // Staff KPIs & Awards
  await prisma.staffAward.deleteMany({ where: { orgId: org.id } });
  
  // Feedback
  await prisma.feedback.deleteMany({ where: { orgId: org.id } });
  
  // Reservations & Events
  await prisma.reservation.deleteMany({ where: { orgId: org.id } });
  
  // Documents
  await prisma.document.deleteMany({ where: { orgId: org.id } });
  
  // Dev Portal (API keys & webhooks)
  await prisma.webhookDelivery.deleteMany({
    where: { subscription: { orgId: org.id } },
  });
  await prisma.webhookSubscription.deleteMany({ where: { orgId: org.id } });
  await prisma.devApiKey.deleteMany({ where: { orgId: org.id } });
  
  // Billing
  await prisma.orgSubscription.deleteMany({ where: { orgId: org.id } });
  
  // Sessions
  await prisma.session.deleteMany({ where: { orgId: org.id } });
  
  // Till sessions & cash movements
  await prisma.cashMovement.deleteMany({
    where: { tillSession: { branchId: { in: branchIds } } },
  });
  await prisma.tillSession.deleteMany({ where: { branchId: { in: branchIds } } });
  
  // Shifts
  await prisma.shiftAssignment.deleteMany({
    where: { schedule: { branchId: { in: branchIds } } },
  });
  await prisma.shiftSchedule.deleteMany({ where: { branchId: { in: branchIds } } });
  await prisma.shift.deleteMany({ where: { branchId: { in: branchIds } } });
  
  // Analytics & Alerts
  await prisma.anomalyEvent.deleteMany({ where: { orgId: org.id } });
  await prisma.ownerDigest.deleteMany({ where: { orgId: org.id } });
  
  // Promotion suggestions
  await prisma.promotionSuggestion.deleteMany({ where: { orgId: org.id } });
  
  // Service providers & reminders
  await prisma.servicePayableReminder.deleteMany({ where: { orgId: org.id } });
  await prisma.serviceContract.deleteMany({
    where: { provider: { orgId: org.id } },
  });
  await prisma.serviceProvider.deleteMany({ where: { orgId: org.id } });
  
  // Ops budgets & cost insights
  await prisma.costInsight.deleteMany({ where: { orgId: org.id } });
  await prisma.opsBudget.deleteMany({ where: { orgId: org.id } });

  console.log('✅ Dynamic data deleted');
  console.log('');
  
  console.log('🌱 Re-seeding 30-day operational data...');
  await seedTapasDemoData(prisma, org.id);
  console.log('');
  
  console.log('✨ Tapas demo reset complete!');
  console.log(`   Org: ${org.name} (${org.id})`);
  console.log(`   Static data preserved: Org, branches, users, menu, inventory`);
  console.log(`   Operational data reset to clean 30-day window`);
}

main()
  .catch((e) => {
    console.error('❌ Error resetting Tapas demo:');
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
