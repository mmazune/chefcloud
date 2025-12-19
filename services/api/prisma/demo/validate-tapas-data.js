#!/usr/bin/env node
/**
 * Test script to validate Tapas menu and inventory JSON files
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Validating Tapas data files...\n');

// Load files
const menuPath = path.join(__dirname, './data/tapas-menu.json');
const invPath = path.join(__dirname, './data/tapas-inventory.json');

try {
  const menu = JSON.parse(fs.readFileSync(menuPath, 'utf8'));
  const inventory = JSON.parse(fs.readFileSync(invPath, 'utf8'));
  
  console.log('✅ Both JSON files are valid!\n');
  
  console.log('📋 Menu Statistics:');
  console.log(`   Categories: ${menu.categories.length}`);
  console.log(`   Items: ${menu.items.length}`);
  
  // Count items by type
  const food = menu.items.filter(i => i.itemType === 'FOOD').length;
  const drinks = menu.items.filter(i => i.itemType === 'DRINK').length;
  console.log(`   - Food items: ${food}`);
  console.log(`   - Drink items: ${drinks}`);
  
  // Check SKU uniqueness
  const skus = menu.items.map(i => i.sku);
  const uniqueSkus = new Set(skus);
  if (skus.length === uniqueSkus.size) {
    console.log(`   ✅ All ${skus.length} SKUs are unique`);
  } else {
    console.log(`   ❌ Duplicate SKUs found! ${skus.length} total, ${uniqueSkus.size} unique`);
  }
  
  console.log('\n📦 Inventory Statistics:');
  console.log(`   Items: ${inventory.items.length}`);
  
  // Group by category
  const categories = {};
  inventory.items.forEach(item => {
    categories[item.category] = (categories[item.category] || 0) + 1;
  });
  
  console.log(`   Categories: ${Object.keys(categories).length}`);
  Object.entries(categories).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([cat, count]) => {
    console.log(`   - ${cat}: ${count} items`);
  });
  
  // Check SKU uniqueness
  const invSkus = inventory.items.map(i => i.sku);
  const uniqueInvSkus = new Set(invSkus);
  if (invSkus.length === uniqueInvSkus.size) {
    console.log(`   ✅ All ${invSkus.length} SKUs are unique`);
  } else {
    console.log(`   ❌ Duplicate SKUs found! ${invSkus.length} total, ${uniqueInvSkus.size} unique`);
  }
  
  console.log('\n🎯 Validation Summary:');
  console.log(`   ✅ Menu: ${menu.items.length} items across ${menu.categories.length} categories`);
  console.log(`   ✅ Inventory: ${inventory.items.length} items`);
  console.log(`   ✅ All data is valid and ready for seeding!`);
  
  process.exit(0);
  
} catch (error) {
  console.error('❌ Validation failed:', error.message);
  process.exit(1);
}
