import { prisma } from '@chefcloud/db';

async function verify() {
  console.log('\n📊 Database Verification:\n');

  // Get Tapas org
  const tapas = await prisma.organization.findFirst({
    where: { name: 'Tapas Bar & Restaurant' },
    include: { branches: true }
  });

  // Get Cafesserie org
  const cafesserie = await prisma.organization.findFirst({
    where: { name: 'Cafesserie' },
    include: { branches: true }
  });

  if (!tapas || !cafesserie) {
    console.log('❌ Demo organizations not found!');
    return;
  }

  // Count menu items for Tapas
  const tapasMenuCount = await prisma.menuItem.count({
    where: { branch: { organizationId: tapas.id } }
  });

  // Count categories for Tapas
  const tapasCategoryCount = await prisma.category.count({
    where: { branch: { organizationId: tapas.id } }
  });

  // Count inventory items for Tapas
  const tapasInventoryCount = await prisma.inventoryItem.count({
    where: { organizationId: tapas.id }
  });

  // Count stock batches for Tapas
  const tapasStockCount = await prisma.stockBatch.count({
    where: { branch: { organizationId: tapas.id } }
  });

  // Count menu items for Cafesserie
  const cafesserieMenuCount = await prisma.menuItem.count({
    where: { branch: { organizationId: cafesserie.id } }
  });

  // Count categories for Cafesserie
  const cafesserieCategoryCount = await prisma.category.count({
    where: { branch: { organizationId: cafesserie.id } }
  });

  console.log('🍷 Tapas Bar & Restaurant:');
  console.log(`   - Branches: ${tapas.branches.length}`);
  console.log(`   - Categories: ${tapasCategoryCount}`);
  console.log(`   - Menu Items: ${tapasMenuCount}`);
  console.log(`   - Inventory Items: ${tapasInventoryCount}`);
  console.log(`   - Stock Batches: ${tapasStockCount}`);

  console.log('\n☕ Cafesserie:');
  console.log(`   - Branches: ${cafesserie.branches.length}`);
  console.log(`   - Categories: ${cafesserieCategoryCount} (expected: ~48 for 4 branches × 12)`);
  console.log(`   - Menu Items: ${cafesserieMenuCount} (expected: ~320 for 4 branches × 80)`);

  // Sample some menu items from each category
  const sampleTapas = await prisma.menuItem.findMany({
    where: { branch: { organizationId: tapas.id } },
    take: 8,
    include: { category: true },
    orderBy: { createdAt: 'asc' }
  });

  console.log('\n🔍 Sample Tapas Menu Items:');
  sampleTapas.forEach(item => {
    const sku = (item.metadata as any)?.sku || 'N/A';
    console.log(`   - ${item.name} (${item.category.name}): UGX ${item.price.toLocaleString()} [SKU: ${sku}]`);
  });

  // Sample some inventory items
  const sampleInventory = await prisma.inventoryItem.findMany({
    where: { organizationId: tapas.id },
    take: 8,
    orderBy: { sku: 'asc' }
  });

  console.log('\n📦 Sample Tapas Inventory Items:');
  sampleInventory.forEach(item => {
    console.log(`   - ${item.name} (${item.sku}): ${item.unit} [${item.category}]`);
  });

  // Check Cafesserie price variations across branches
  const cafesserieBranches = await prisma.branch.findMany({
    where: { organizationId: cafesserie.id },
    orderBy: { name: 'asc' }
  });

  console.log('\n💰 Cafesserie Price Variations (Same Item Across Branches):');
  const testItem = 'Espresso';
  for (const branch of cafesserieBranches) {
    const item = await prisma.menuItem.findFirst({
      where: { branchId: branch.id, name: testItem }
    });
    if (item) {
      console.log(`   - ${branch.name}: UGX ${item.price.toLocaleString()}`);
    }
  }

  console.log('\n✅ Verification complete!\n');

  await prisma.$disconnect();
}

verify().catch(console.error);
