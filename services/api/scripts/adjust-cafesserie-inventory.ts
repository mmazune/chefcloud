import * as fs from 'fs';
import * as path from 'path';

/**
 * Adjusts Cafesserie inventory initialStock values to create realistic distribution
 * Target: 75% OK, 15% Low, 5% Critical (under 10% critical)
 */

const filePath = path.join(__dirname, '../prisma/demo/data/cafesserie-inventory.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));

// Calculate target counts (77 items total)
const totalItems = data.items.length;
const targetCritical = Math.floor(totalItems * 0.05); // 5% = ~4 items
const targetLow = Math.floor(totalItems * 0.15);      // 15% = ~12 items
const targetOK = totalItems - targetCritical - targetLow; // rest = ~61 items

console.log(`📊 Target Distribution for ${totalItems} items:`);
console.log(`  OK: ${targetOK} (${((targetOK / totalItems) * 100).toFixed(1)}%)`);
console.log(`  Low: ${targetLow} (${((targetLow / totalItems) * 100).toFixed(1)}%)`);
console.log(`  Critical: ${targetCritical} (${((targetCritical / totalItems) * 100).toFixed(1)}%)`);

// Adjust items
let criticalCount = 0;
let lowCount = 0;

for (let i = 0; i < data.items.length; i++) {
  const item = data.items[i];
  const reorderLevel = item.reorderLevel;

  // Deterministic assignment based on index
  if (criticalCount < targetCritical) {
    // Critical: 0 to 0.5x reorderLevel
    const factor = (i * 0.3) % 0.5; // deterministic 0-0.5
    item.initialStock = parseFloat((reorderLevel * factor).toFixed(1));
    criticalCount++;
  } else if (lowCount < targetLow) {
    // Low: 0.5x to 1x reorderLevel
    const factor = 0.5 + ((i * 0.4) % 0.5); // deterministic 0.5-1.0
    item.initialStock = parseFloat((reorderLevel * factor).toFixed(1));
    lowCount++;
  } else {
    // OK: > 1x reorderLevel (keep existing or increase)
    const factor = 2 + (i % 3); // deterministic 2x-4x
    item.initialStock = parseFloat((reorderLevel * factor).toFixed(1));
  }
}

// Write back to file
fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');

console.log(`\n✅ Updated ${filePath}`);
console.log(`   Applied: ${criticalCount} critical, ${lowCount} low, ${totalItems - criticalCount - lowCount} ok`);
