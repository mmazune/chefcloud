/**
 * Test script for consumption seeding
 */

import { prisma } from '@chefcloud/db';
import { seedInventoryConsumption } from './demo/seedInventoryConsumption';

async function main() {
  console.log('Testing consumption seeding...\n');
  
  await seedInventoryConsumption(prisma);
  
  console.log('\n✅ Test complete!');
}

main()
  .catch((e) => {
    console.error('❌ Test failed:', e);
    console.error('Stack:', e.stack);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
