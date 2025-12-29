import { PrismaClient } from '@chefcloud/db';

const prisma = new PrismaClient();

async function main() {
  const owners = await prisma.user.findMany({
    where: { email: { contains: 'owner@' } },
    select: { email: true, firstName: true, lastName: true }
  });
  
  console.log('Owners in database:');
  owners.forEach(o => {
    console.log(`  ${o.email} => ${o.firstName} ${o.lastName}`);
  });
  
  // Verify Tapas and Cafesserie owners are named Joshua (V2.1 requirement)
  const tapasOwner = owners.find(o => o.email === 'owner@tapas.demo.local');
  const cafesserieOwner = owners.find(o => o.email === 'owner@cafesserie.demo.local');
  
  const tapasOk = tapasOwner?.firstName === 'Joshua';
  const cafesserieOk = cafesserieOwner?.firstName === 'Joshua';
  
  console.log(`\nV2.1 Owner Verification:`);
  console.log(`  Tapas owner named Joshua: ${tapasOk ? '✅ YES' : '❌ NO'}`);
  console.log(`  Cafesserie owner named Joshua: ${cafesserieOk ? '✅ YES' : '❌ NO'}`);
  console.log(`\nV2.1 Patch Complete: ${tapasOk && cafesserieOk ? '✅ YES' : '❌ NO'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
