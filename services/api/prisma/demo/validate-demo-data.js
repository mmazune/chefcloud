#!/usr/bin/env node
/**
 * Validation Script for Demo Data (Milestone 2 Phase 2)
 * 
 * Validates Tapas and Cafesserie JSON data files for:
 * - Recipe count matches menu item count
 * - All ingredients reference valid inventory SKUs
 * - No duplicate SKUs
 * - Data integrity
 */

const fs = require('fs');
const path = require('path');

// Load data files
const tapasMenu = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/tapas-menu.json'), 'utf8'));
const tapasInventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/tapas-inventory.json'), 'utf8'));
const tapasRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/tapas-recipes.json'), 'utf8'));

const cafesserieMenu = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cafesserie-menu.json'), 'utf8'));
const cafesserieInventory = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cafesserie-inventory.json'), 'utf8'));
const cafesserieRecipes = JSON.parse(fs.readFileSync(path.join(__dirname, 'data/cafesserie-recipes.json'), 'utf8'));

let errors = 0;
let warnings = 0;

console.log('\n🔍 Validating Demo Data Files...\n');

// === TAPAS VALIDATION ===
console.log('📋 TAPAS BAR & RESTAURANT');
console.log('─────────────────────────');

// Build inventory SKU map
const tapasInventorySKUs = new Set(tapasInventory.items.map(item => item.sku));
const tapasMenuSKUs = new Set(tapasMenu.items.map(item => item.sku));
const tapasRecipeSKUs = new Set(tapasRecipes.map(r => r.menuSku));

// Check for duplicate menu SKUs
const tapasMenuDuplicates = tapasMenu.items.map(i => i.sku).filter((sku, idx, arr) => arr.indexOf(sku) !== idx);
if (tapasMenuDuplicates.length > 0) {
  console.error(`❌ Duplicate menu SKUs found: ${[...new Set(tapasMenuDuplicates)].join(', ')}`);
  errors++;
}

// Check for duplicate inventory SKUs
const tapasInvDuplicates = tapasInventory.items.map(i => i.sku).filter((sku, idx, arr) => arr.indexOf(sku) !== idx);
if (tapasInvDuplicates.length > 0) {
  console.error(`❌ Duplicate inventory SKUs found: ${[...new Set(tapasInvDuplicates)].join(', ')}`);
  errors++;
}

// Check recipe count matches menu count
console.log(`Menu items: ${tapasMenu.items.length}`);
console.log(`Recipes: ${tapasRecipes.length}`);
if (tapasMenu.items.length !== tapasRecipes.length) {
  console.error(`❌ Recipe count (${tapasRecipes.length}) does NOT match menu count (${tapasMenu.items.length})`);
  errors++;
} else {
  console.log('✅ Recipe count matches menu count');
}

// Check all menu items have recipes
const tapasOrphanItems = tapasMenu.items.filter(item => !tapasRecipeSKUs.has(item.sku));
if (tapasOrphanItems.length > 0) {
  console.error(`❌ ${tapasOrphanItems.length} menu items missing recipes:`);
  tapasOrphanItems.slice(0, 5).forEach(item => console.error(`   - ${item.sku}: ${item.name}`));
  if (tapasOrphanItems.length > 5) console.error(`   ... and ${tapasOrphanItems.length - 5} more`);
  errors++;
}

// Check all recipes reference valid menu SKUs
const tapasOrphanRecipes = tapasRecipes.filter(r => !tapasMenuSKUs.has(r.menuSku));
if (tapasOrphanRecipes.length > 0) {
  console.warn(`⚠️  ${tapasOrphanRecipes.length} recipes reference non-existent menu items`);
  tapasOrphanRecipes.slice(0, 3).forEach(r => console.warn(`   - ${r.menuSku}: ${r.menuName}`));
  warnings++;
}

// Check all recipe ingredients reference valid inventory SKUs
let tapasInvalidIngredients = 0;
tapasRecipes.forEach(recipe => {
  recipe.ingredients.forEach(ing => {
    if (!tapasInventorySKUs.has(ing.inventorySku)) {
      if (tapasInvalidIngredients < 5) {
        console.error(`❌ Invalid inventory SKU in ${recipe.menuName}: ${ing.inventorySku}`);
      }
      tapasInvalidIngredients++;
    }
  });
});
if (tapasInvalidIngredients > 0) {
  console.error(`❌ ${tapasInvalidIngredients} invalid inventory references in recipes`);
  errors++;
} else {
  console.log('✅ All recipe ingredients reference valid inventory SKUs');
}

// Count recipes needing confirmation
const tapasNeedsConfirmation = tapasRecipes.filter(r => r.needsConfirmation);
if (tapasNeedsConfirmation.length > 0) {
  console.log(`⚠️  ${tapasNeedsConfirmation.length} recipes marked needsConfirmation`);
}

// Category breakdown
const tapasByCategory = {};
tapasMenu.items.forEach(item => {
  tapasByCategory[item.category] = (tapasByCategory[item.category] || 0) + 1;
});
console.log('\n📊 Items by Category:');
Object.entries(tapasByCategory).sort((a, b) => b[1] - a[1]).slice(0, 10).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});

// === CAFESSERIE VALIDATION ===
console.log('\n📋 CAFESSERIE');
console.log('────────────');

// Build inventory SKU map
const cafeInventorySKUs = new Set(cafesserieInventory.items.map(item => item.sku));
const cafeMenuSKUs = new Set(cafesserieMenu.items.map(item => item.sku));
const cafeRecipeSKUs = new Set(cafesserieRecipes.map(r => r.menuSku));

// Check for duplicate SKUs
const cafeMenuDuplicates = cafesserieMenu.items.map(i => i.sku).filter((sku, idx, arr) => arr.indexOf(sku) !== idx);
if (cafeMenuDuplicates.length > 0) {
  console.error(`❌ Duplicate menu SKUs found: ${[...new Set(cafeMenuDuplicates)].join(', ')}`);
  errors++;
}

const cafeInvDuplicates = cafesserieInventory.items.map(i => i.sku).filter((sku, idx, arr) => arr.indexOf(sku) !== idx);
if (cafeInvDuplicates.length > 0) {
  console.error(`❌ Duplicate inventory SKUs found: ${[...new Set(cafeInvDuplicates)].join(', ')}`);
  errors++;
}

// Check recipe coverage
console.log(`Menu items: ${cafesserieMenu.items.length}`);
console.log(`Recipes: ${cafesserieRecipes.length}`);

// Enforce exact recipe count match (Milestone 2 requirement)
if (cafesserieMenu.items.length !== cafesserieRecipes.length) {
  console.error(`❌ Recipe count (${cafesserieRecipes.length}) does NOT match menu count (${cafesserieMenu.items.length})`);
  errors++;
} else {
  console.log('✅ Recipe count matches menu count');
}

// Check all menu items have recipes
const cafeOrphanItems = cafesserieMenu.items.filter(item => !cafeRecipeSKUs.has(item.sku));
if (cafeOrphanItems.length > 0) {
  console.error(`❌ ${cafeOrphanItems.length} menu items missing recipes:`);
  cafeOrphanItems.slice(0, 5).forEach(item => console.error(`   - ${item.sku}: ${item.name}`));
  if (cafeOrphanItems.length > 5) console.error(`   ... and ${cafeOrphanItems.length - 5} more`);
  errors++;
}

// Check all recipes reference valid menu SKUs
const cafeOrphanRecipes = cafesserieRecipes.filter(r => !cafeMenuSKUs.has(r.menuSku));
if (cafeOrphanRecipes.length > 0) {
  console.warn(`⚠️  ${cafeOrphanRecipes.length} recipes reference non-existent menu items`);
  cafeOrphanRecipes.slice(0, 3).forEach(r => console.warn(`   - ${r.menuSku}: ${r.menuName}`));
  warnings++;
}

// Check all recipe ingredients reference valid inventory SKUs
let cafeInvalidIngredients = 0;
cafesserieRecipes.forEach(recipe => {
  recipe.ingredients.forEach(ing => {
    if (!cafeInventorySKUs.has(ing.inventorySku)) {
      if (cafeInvalidIngredients < 5) {
        console.error(`❌ Invalid inventory SKU in ${recipe.menuName}: ${ing.inventorySku}`);
      }
      cafeInvalidIngredients++;
    }
  });
});
if (cafeInvalidIngredients > 0) {
  console.error(`❌ ${cafeInvalidIngredients} invalid inventory references in recipes`);
  errors++;
} else {
  console.log('✅ All recipe ingredients reference valid inventory SKUs');
}

// Category breakdown
const cafeByCategory = {};
cafesserieMenu.items.forEach(item => {
  cafeByCategory[item.category] = (cafeByCategory[item.category] || 0) + 1;
});
console.log('\n📊 Items by Category:');
Object.entries(cafeByCategory).sort((a, b) => b[1] - a[1]).forEach(([cat, count]) => {
  console.log(`   ${cat}: ${count}`);
});

// === SUMMARY ===
console.log('\n═══════════════════════════════════════');
console.log('📊 VALIDATION SUMMARY');
console.log('═══════════════════════════════════════');
console.log(`\n🍷 TAPAS:`);
console.log(`   Menu Items: ${tapasMenu.items.length}`);
console.log(`   Inventory Items: ${tapasInventory.items.length}`);
console.log(`   Recipes: ${tapasRecipes.length}`);
console.log(`   Categories: ${tapasMenu.categories.length}`);

console.log(`\n☕ CAFESSERIE:`);
console.log(`   Menu Items: ${cafesserieMenu.items.length}`);
console.log(`   Inventory Items: ${cafesserieInventory.items.length}`);
console.log(`   Recipes: ${cafesserieRecipes.length}`);
console.log(`   Categories: ${cafesserieMenu.categories.length}`);

console.log(`\n${errors === 0 ? '✅' : '❌'} Errors: ${errors}`);
console.log(`${warnings === 0 ? '✅' : '⚠️ '} Warnings: ${warnings}`);

if (errors === 0 && warnings === 0) {
  console.log('\n🎉 All validations passed!\n');
  process.exit(0);
} else if (errors === 0) {
  console.log('\n⚠️  Validation passed with warnings\n');
  process.exit(0);
} else {
  console.log('\n❌ Validation failed\n');
  process.exit(1);
}
