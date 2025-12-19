import { PrismaClient } from '../../packages/db/dist/index.js';

const prisma = new PrismaClient();

async function verify() {
  try {
    console.log('\n📊 Database Verification:\n');

    const tapas = await prisma.organization.findFirst({
      where: { name: 'Tapas Bar & Restaurant' }
    });

    const cafesserie = await prisma.organization.findFirst({
      where: { name: 'Cafesserie' }
    });

    if (!tapas || !cafesserie) {
      console.log('❌ Demo organizations not found!');
      await prisma.$disconnect();
      return;
    }

    const [
      tapasMenuCount,
      tapasCategoryCount,
      tapasInventoryCount,
      tapasStockCount,
      cafesserieMenuCount,
      cafesserieCategoryCount,
      cafesserieBranchCount
    ] = await Promise.all([
      prisma.menuItem.count({ where: { branch: { organizationId: tapas.id } } }),
      prisma.category.count({ where: { branch: { organizationId: tapas.id } } }),
      prisma.inventoryItem.count({ where: { organizationId: tapas.id } }),
      prisma.stockBatch.count({ where: { branch: { organizationId: tapas.id } } }),
      prisma.menuItem.count({ where: { branch: { organizationId: cafesserie.id } } }),
      prisma.category.count({ where: { branch: { organizationId: cafesserie.id } } }),
      prisma.branch.count({ where: { organizationId: cafesserie.id } })
    ]);

    console.log('🍷 Tapas Bar & Restaurant:');
    console.log(`   - Categories: ${tapasCategoryCount} (expected: 15)`);
    console.log(`   - Menu Items: ${tapasMenuCount} (expected: 75+)`);
    console.log(`   - Inventory Items: ${tapasInventoryCount} (expected: 70+)`);
    console.log(`   - Stock Batches: ${tapasStockCount} (expected: 70+)`);

    console.log('\n☕ Cafesserie:');
    console.log(`   - Branches: ${cafesserieBranchCount} (expected: 4)`);
    console.log(`   - Categories: ${cafesserieCategoryCount} (expected: ~48)`);
    console.log(`   - Menu Items: ${cafesserieMenuCount} (expected: ~320)`);

    // Sample items
    const sampleItems = await prisma.menuItem.findMany({
      where: { branch: { organizationId: tapas.id } },
      include: { category: true },
      take: 5
    });

    console.log('\n�� Sample Tapas Menu Items:');
    sampleItems.forEach(item => {
      console.log(`   - ${item.name} (${item.category.name}): UGX ${item.price.toLocaleString()}`);
    });

    console.log('\n✅ Verification complete!\n');

    await prisma.$disconnect();
  } catch (e) {
    console.error('Error:', e);
    await prisma.$disconnect();
    process.exit(1);
  }
}

verify();
