import { PrismaClient } from '@chefcloud/db';

const prisma = new PrismaClient();

async function main() {
  const branches = [
    '00000000-0000-4000-8000-000000000101', // Tapas
    '00000000-0000-4000-8000-000000000201', // Village Mall
    '00000000-0000-4000-8000-000000000202', // Acacia Mall
    '00000000-0000-4000-8000-000000000203', // Arena Mall
    '00000000-0000-4000-8000-000000000204', // Mombasa
  ];

  const branchNames = {
    '00000000-0000-4000-8000-000000000101': 'Tapas',
    '00000000-0000-4000-8000-000000000201': 'Village Mall',
    '00000000-0000-4000-8000-000000000202': 'Acacia Mall',
    '00000000-0000-4000-8000-000000000203': 'Arena Mall',
    '00000000-0000-4000-8000-000000000204': 'Mombasa',
  };

  const results: Record<string, any> = {};

  for (const branchId of branches) {
    // Get all stock batches for this branch
    const stockBatches = await prisma.stockBatch.findMany({
      where: { branchId },
      select: {
        id: true,
        itemId: true,
        remainingQty: true,
        item: {
          select: {
            id: true,
            name: true,
            reorderLevel: true,
            unit: true,
          },
        },
      },
    });

    // Group by itemId and sum remainingQty
    const itemStocks = new Map<string, { name: string; currentStock: number; reorderLevel: number; unit: string }>();
    
    for (const batch of stockBatches) {
      const existing = itemStocks.get(batch.itemId);
      if (existing) {
        existing.currentStock += Number(batch.remainingQty);
      } else {
        itemStocks.set(batch.itemId, {
          name: batch.item.name,
          currentStock: Number(batch.remainingQty),
          reorderLevel: Number(batch.item.reorderLevel),
          unit: batch.item.unit,
        });
      }
    }

    const inventory = Array.from(itemStocks.values());
    const total = inventory.length;
    const critical = inventory.filter(
      (i) => i.currentStock <= i.reorderLevel * 0.5
    ).length;
    const low = inventory.filter(
      (i) =>
        i.currentStock > i.reorderLevel * 0.5 &&
        i.currentStock <= i.reorderLevel
    ).length;
    const ok = total - critical - low;

    results[branchNames[branchId]] = {
      branchId,
      total,
      ok,
      low,
      critical,
      okPct: ((ok / total) * 100).toFixed(2) + '%',
      lowPct: ((low / total) * 100).toFixed(2) + '%',
      criticalPct: ((critical / total) * 100).toFixed(2) + '%',
    };
  }

  console.log('\n📊 BASELINE INVENTORY DISTRIBUTION\n');
  console.log(JSON.stringify(results, null, 2));

  // Also print summary table
  console.log('\n\n📋 SUMMARY TABLE:\n');
  console.log('Branch'.padEnd(20) + 'Total'.padEnd(10) + 'OK'.padEnd(10) + 'Low'.padEnd(10) + 'Critical'.padEnd(12) + 'Critical %');
  console.log('-'.repeat(70));
  
  for (const [name, data] of Object.entries(results)) {
    console.log(
      name.padEnd(20) +
      data.total.toString().padEnd(10) +
      data.ok.toString().padEnd(10) +
      data.low.toString().padEnd(10) +
      data.critical.toString().padEnd(12) +
      data.criticalPct
    );
  }
}

main().finally(() => prisma.$disconnect());
