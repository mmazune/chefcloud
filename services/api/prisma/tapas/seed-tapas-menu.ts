import { PrismaClient } from '@prisma/client';

interface MenuCategoryData {
  name: string;
  sortOrder: number;
  items: Array<{
    code: string;
    name: string;
    priceCents: number;
    costCents?: number;
    description?: string;
  }>;
}

export async function seedTapasMenu(
  prisma: PrismaClient,
  orgId: string,
): Promise<void> {
  console.log('  🍽️  Seeding Tapas menu...');

  const categories: MenuCategoryData[] = [
    {
      name: 'Small Plates',
      sortOrder: 1,
      items: [
        { code: 'SP-001', name: 'Patatas Bravas', priceCents: 18_000_00, costCents: 6_000_00 },
        { code: 'SP-002', name: 'Garlic Prawns', priceCents: 32_000_00, costCents: 11_000_00 },
        { code: 'SP-003', name: 'Chorizo in Red Wine', priceCents: 28_000_00, costCents: 9_500_00 },
        { code: 'SP-004', name: 'Stuffed Peppers', priceCents: 22_000_00, costCents: 7_000_00 },
        { code: 'SP-005', name: 'Albondigas (Meatballs)', priceCents: 24_000_00, costCents: 8_000_00 },
        { code: 'SP-006', name: 'Calamari Fritos', priceCents: 30_000_00, costCents: 10_500_00 },
        { code: 'SP-007', name: 'Pan con Tomate', priceCents: 15_000_00, costCents: 4_500_00 },
        { code: 'SP-008', name: 'Cheese Croquettes', priceCents: 20_000_00, costCents: 6_500_00 },
      ],
    },
    {
      name: 'Mains',
      sortOrder: 2,
      items: [
        { code: 'M-001', name: 'Paella Valenciana', priceCents: 48_000_00, costCents: 16_000_00 },
        { code: 'M-002', name: 'Seafood Paella', priceCents: 55_000_00, costCents: 19_000_00 },
        { code: 'M-003', name: 'Grilled Sea Bass', priceCents: 52_000_00, costCents: 18_000_00 },
        { code: 'M-004', name: 'Beef Tenderloin', priceCents: 58_000_00, costCents: 19_500_00 },
        { code: 'M-005', name: 'Roasted Chicken', priceCents: 42_000_00, costCents: 13_500_00 },
        { code: 'M-006', name: 'Lamb Chops', priceCents: 62_000_00, costCents: 21_000_00 },
        { code: 'M-007', name: 'Vegetable Paella', priceCents: 38_000_00, costCents: 12_000_00 },
        { code: 'M-008', name: 'Pasta Marinara', priceCents: 36_000_00, costCents: 11_000_00 },
      ],
    },
    {
      name: 'Desserts',
      sortOrder: 3,
      items: [
        { code: 'D-001', name: 'Churros con Chocolate', priceCents: 18_000_00, costCents: 5_500_00 },
        { code: 'D-002', name: 'Crema Catalana', priceCents: 16_000_00, costCents: 5_000_00 },
        { code: 'D-003', name: 'Flan', priceCents: 15_000_00, costCents: 4_500_00 },
        { code: 'D-004', name: 'Tarta de Santiago', priceCents: 20_000_00, costCents: 6_500_00 },
        { code: 'D-005', name: 'Gelato Selection', priceCents: 14_000_00, costCents: 4_000_00 },
      ],
    },
    {
      name: 'Non-Alcoholic Drinks',
      sortOrder: 4,
      items: [
        { code: 'NA-001', name: 'Fresh Passion Juice', priceCents: 12_000_00, costCents: 3_500_00 },
        { code: 'NA-002', name: 'Fresh Pineapple Juice', priceCents: 12_000_00, costCents: 3_500_00 },
        { code: 'NA-003', name: 'Fresh Mango Juice', priceCents: 13_000_00, costCents: 4_000_00 },
        { code: 'NA-004', name: 'Coca-Cola', priceCents: 5_000_00, costCents: 2_000_00 },
        { code: 'NA-005', name: 'Sprite', priceCents: 5_000_00, costCents: 2_000_00 },
        { code: 'NA-006', name: 'Fanta', priceCents: 5_000_00, costCents: 2_000_00 },
        { code: 'NA-007', name: 'Bottled Water', priceCents: 3_000_00, costCents: 1_200_00 },
        { code: 'NA-008', name: 'Sparkling Water', priceCents: 6_000_00, costCents: 2_500_00 },
        { code: 'NA-009', name: 'Iced Tea', priceCents: 8_000_00, costCents: 2_500_00 },
        { code: 'NA-010', name: 'Coffee', priceCents: 8_000_00, costCents: 2_500_00 },
      ],
    },
    {
      name: 'Beers & Ciders',
      sortOrder: 5,
      items: [
        { code: 'B-001', name: 'Nile Special', priceCents: 8_000_00, costCents: 3_500_00 },
        { code: 'B-002', name: 'Club Pilsner', priceCents: 8_000_00, costCents: 3_500_00 },
        { code: 'B-003', name: 'Bell Lager', priceCents: 7_000_00, costCents: 3_200_00 },
        { code: 'B-004', name: 'Guinness', priceCents: 10_000_00, costCents: 4_500_00 },
        { code: 'B-005', name: 'Tusker', priceCents: 9_000_00, costCents: 4_000_00 },
        { code: 'B-006', name: 'Smirnoff Ice', priceCents: 10_000_00, costCents: 4_500_00 },
      ],
    },
    {
      name: 'Wines',
      sortOrder: 6,
      items: [
        { code: 'W-001', name: 'House Red (Glass)', priceCents: 15_000_00, costCents: 5_000_00 },
        { code: 'W-002', name: 'House White (Glass)', priceCents: 15_000_00, costCents: 5_000_00 },
        { code: 'W-003', name: 'House Red (Bottle)', priceCents: 75_000_00, costCents: 25_000_00 },
        { code: 'W-004', name: 'House White (Bottle)', priceCents: 75_000_00, costCents: 25_000_00 },
        { code: 'W-005', name: 'Prosecco (Bottle)', priceCents: 95_000_00, costCents: 32_000_00 },
        { code: 'W-006', name: 'Premium Red (Bottle)', priceCents: 120_000_00, costCents: 42_000_00 },
      ],
    },
    {
      name: 'Spirits & Cocktails',
      sortOrder: 7,
      items: [
        { code: 'S-001', name: 'Uganda Waragi (Shot)', priceCents: 8_000_00, costCents: 2_500_00 },
        { code: 'S-002', name: 'Jameson (Shot)', priceCents: 12_000_00, costCents: 4_500_00 },
        { code: 'S-003', name: 'Jack Daniels (Shot)', priceCents: 15_000_00, costCents: 5_500_00 },
        { code: 'S-004', name: 'Tanqueray Gin (Shot)', priceCents: 13_000_00, costCents: 5_000_00 },
        { code: 'S-005', name: 'Johnnie Walker Black (Shot)', priceCents: 18_000_00, costCents: 7_000_00 },
        { code: 'S-006', name: 'Mojito', priceCents: 22_000_00, costCents: 7_500_00 },
        { code: 'S-007', name: 'Sangria (Glass)', priceCents: 18_000_00, costCents: 6_000_00 },
        { code: 'S-008', name: 'Margarita', priceCents: 24_000_00, costCents: 8_000_00 },
      ],
    },
  ];

  // Seed categories and items
  for (const categoryData of categories) {
    // Check if we already have a MenuCategory model or need to use a different approach
    // For now, let's assume we have a structure similar to the demo seed
    
    console.log(`    📋 ${categoryData.name} (${categoryData.items.length} items)`);
    
    // Note: Actual implementation depends on your schema structure for menu categories/items
    // This is a placeholder structure - you'll need to adapt to your actual Prisma schema
    
    // Example structure (adapt to your schema):
    // const category = await prisma.menuCategory.upsert({
    //   where: { orgId_name: { orgId, name: categoryData.name } },
    //   update: { sortOrder: categoryData.sortOrder },
    //   create: {
    //     orgId,
    //     name: categoryData.name,
    //     sortOrder: categoryData.sortOrder,
    //   },
    // });

    // for (const item of categoryData.items) {
    //   await prisma.menuItem.upsert({
    //     where: { orgId_code: { orgId, code: item.code } },
    //     update: {
    //       name: item.name,
    //       priceCents: item.priceCents,
    //       costCents: item.costCents,
    //     },
    //     create: {
    //       orgId,
    //       categoryId: category.id,
    //       code: item.code,
    //       name: item.name,
    //       priceCents: item.priceCents,
    //       costCents: item.costCents,
    //       isActive: true,
    //     },
    //   });
    // }
  }

  console.log('    ✅ Menu seeding complete (placeholder)');
}

export async function seedTapasInventory(
  prisma: PrismaClient,
  orgId: string,
  branchIds: { cbd: string; kololo: string },
): Promise<void> {
  console.log('  📦 Seeding Tapas inventory...');

  // Basic inventory items (adapt to your schema)
  const inventoryItems = [
    { code: 'INV-001', name: 'Chicken Wings (kg)', unit: 'kg', costPerUnit: 15_000_00 },
    { code: 'INV-002', name: 'Chicken Fillet (kg)', unit: 'kg', costPerUnit: 18_000_00 },
    { code: 'INV-003', name: 'Beef Tenderloin (kg)', unit: 'kg', costPerUnit: 35_000_00 },
    { code: 'INV-004', name: 'Lamb (kg)', unit: 'kg', costPerUnit: 32_000_00 },
    { code: 'INV-005', name: 'Sea Bass (kg)', unit: 'kg', costPerUnit: 28_000_00 },
    { code: 'INV-006', name: 'Prawns (kg)', unit: 'kg', costPerUnit: 42_000_00 },
    { code: 'INV-007', name: 'Calamari (kg)', unit: 'kg', costPerUnit: 24_000_00 },
    { code: 'INV-008', name: 'Potatoes (kg)', unit: 'kg', costPerUnit: 3_000_00 },
    { code: 'INV-009', name: 'Rice (kg)', unit: 'kg', costPerUnit: 4_500_00 },
    { code: 'INV-010', name: 'Cooking Oil (L)', unit: 'L', costPerUnit: 12_000_00 },
    { code: 'INV-011', name: 'Passion Fruit (kg)', unit: 'kg', costPerUnit: 5_000_00 },
    { code: 'INV-012', name: 'Pineapple (kg)', unit: 'kg', costPerUnit: 4_000_00 },
    { code: 'INV-013', name: 'Mango (kg)', unit: 'kg', costPerUnit: 6_000_00 },
    { code: 'INV-014', name: 'Nile Special (crate)', unit: 'crate', costPerUnit: 58_000_00 },
    { code: 'INV-015', name: 'Club Pilsner (crate)', unit: 'crate', costPerUnit: 58_000_00 },
    { code: 'INV-016', name: 'Bell Lager (crate)', unit: 'crate', costPerUnit: 52_000_00 },
    { code: 'INV-017', name: 'Coca-Cola (crate)', unit: 'crate', costPerUnit: 24_000_00 },
    { code: 'INV-018', name: 'House Wine Red (bottle)', unit: 'bottle', costPerUnit: 25_000_00 },
    { code: 'INV-019', name: 'House Wine White (bottle)', unit: 'bottle', costPerUnit: 25_000_00 },
    { code: 'INV-020', name: 'Jameson Whiskey (bottle)', unit: 'bottle', costPerUnit: 75_000_00 },
  ];

  console.log('    ✅ Inventory seeding complete (placeholder)');
  
  // Note: Actual implementation depends on your inventory schema
  // Adapt the above data structure to match your Prisma models
}
