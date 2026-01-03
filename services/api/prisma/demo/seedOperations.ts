/**
 * ChefCloud V2 - Milestone 5: Operational Data Seeder
 * 
 * Seeds deterministic, realistic operational data:
 * - Staff/Employees with roles, salaries, contracts
 * - Service Providers (utilities, rent, etc.) with contracts
 * - Vendors with bills and payments
 * - Reservations (Tapas focus)
 * - Customer Feedback/NPS
 * 
 * DETERMINISTIC: Uses fixed RNG seed "chefcloud-demo-v2-m5"
 * IDEMPOTENT: Deletes + recreates only demo org records in date range
 * DATE ALIGNMENT: Tapas 90d, Cafesserie 180d
 */

import { PrismaClient, Prisma } from '@chefcloud/db';
import { createSeededRandom } from './generate/seededRng';

const RNG_SEED = 'chefcloud-demo-v2-m5';
const seededRng = createSeededRandom(RNG_SEED);

// Demo org IDs (hardcoded from schema)
const TAPAS_ORG_ID = '00000000-0000-4000-8000-000000000001';
const TAPAS_BRANCH_ID = '00000000-0000-4000-8000-000000000101';
const CAFESSERIE_ORG_ID = '00000000-0000-4000-8000-000000000002';
const CAF_BRANCHES = {
  'Village Mall': '00000000-0000-4000-8000-000000000201',
  'Acacia Mall': '00000000-0000-4000-8000-000000000202',
  'Arena Mall': '00000000-0000-4000-8000-000000000203',
  'Mombasa': '00000000-0000-4000-8000-000000000204',
};

// Date ranges
const NOW = new Date('2025-12-21T00:00:00Z');
const TAPAS_START = new Date(NOW);
TAPAS_START.setDate(NOW.getDate() - 90);
const CAF_START = new Date(NOW);
CAF_START.setDate(NOW.getDate() - 180);

// Helper functions
function randomInt(min: number, max: number): number {
  return seededRng.nextInt(min, max);
}

function randomElement<T>(arr: T[]): T {
  return seededRng.pick(arr);
}

function randomDate(start: Date, end: Date): Date {
  const timestamp = start.getTime() + seededRng.next() * (end.getTime() - start.getTime());
  return new Date(timestamp);
}

function shuffle<T>(arr: T[]): T[] {
  return seededRng.shuffle(arr);
}

/**
 * STEP 1: Cleanup existing operational data for demo orgs
 */
async function cleanupOperationalData(prisma: PrismaClient) {
  console.log('🧹 Cleaning up existing operational data...');
  
  // FAST CHECK: Count employees to see if cleanup is needed
  const empCount = await prisma.employee.count({
    where: { orgId: { in: [TAPAS_ORG_ID, CAFESSERIE_ORG_ID] } },
  });
  
  if (empCount === 0) {
    console.log('  ℹ️  No existing operational data found - skipping cleanup');
    return;
  }
  
  console.log(`  📊 Found ${empCount} employees - performing cleanup...`);
  
  const demoOrgIds = [TAPAS_ORG_ID, CAFESSERIE_ORG_ID];
  
  // Delete in dependency order - simpler version without nested queries
  await prisma.feedback.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  await prisma.reservationReminder.deleteMany({ where: { reservation: { orgId: { in: demoOrgIds } } } });
  await prisma.reservation.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  
  await prisma.vendorPayment.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  await prisma.vendorBill.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  await prisma.vendor.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  
  await prisma.serviceContract.deleteMany({ where: { provider: { orgId: { in: demoOrgIds } } } });
  await prisma.serviceProvider.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  
  await prisma.staffAward.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  await prisma.attendanceRecord.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  
  await prisma.employmentContract.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  await prisma.employee.deleteMany({ where: { orgId: { in: demoOrgIds } } });
  
  console.log('  ✅ Cleanup complete');
}

/**
 * STEP 2: Seed Employees for Tapas (single branch)
 */
async function seedTapasEmployees(prisma: PrismaClient) {
  console.log('👥 Seeding Tapas employees...');
  
  const employeeData = [
    // Owner/Management (L5)
    { firstName: 'Robert', lastName: 'Mugisha', position: 'Owner & CEO', level: 'L5', salary: 8000000, type: 'PERMANENT' },
    { firstName: 'Sarah', lastName: 'Nakato', position: 'General Manager', level: 'L4', salary: 4500000, type: 'PERMANENT' },
    
    // Back office (L4)
    { firstName: 'David', lastName: 'Okello', position: 'Head Chef', level: 'L4', salary: 3500000, type: 'PERMANENT' },
    { firstName: 'Grace', lastName: 'Namukasa', position: 'Accountant', level: 'L4', salary: 3200000, type: 'PERMANENT' },
    { firstName: 'James', lastName: 'Kiiza', position: 'Procurement Manager', level: 'L4', salary: 2800000, type: 'PERMANENT' },
    
    // Kitchen staff (L3)
    { firstName: 'Peter', lastName: 'Ssemakula', position: 'Sous Chef', level: 'L3', salary: 2200000, type: 'PERMANENT' },
    { firstName: 'Mary', lastName: 'Nabukalu', position: 'Pastry Chef', level: 'L3', salary: 2000000, type: 'PERMANENT' },
    { firstName: 'Isaac', lastName: 'Opio', position: 'Line Cook', level: 'L3', salary: 1800000, type: 'PERMANENT' },
    { firstName: 'Betty', lastName: 'Akello', position: 'Line Cook', level: 'L3', salary: 1800000, type: 'PERMANENT' },
    { firstName: 'Moses', lastName: 'Wandera', position: 'Prep Cook', level: 'L2', salary: 1400000, type: 'PERMANENT' },
    { firstName: 'Stella', lastName: 'Nabirye', position: 'Kitchen Assistant', level: 'L2', salary: 1200000, type: 'PERMANENT' },
    
    // Bar staff (L3/L2)
    { firstName: 'Richard', lastName: 'Mubiru', position: 'Head Bartender', level: 'L3', salary: 2000000, type: 'PERMANENT' },
    { firstName: 'Catherine', lastName: 'Nantongo', position: 'Bartender', level: 'L2', salary: 1500000, type: 'PERMANENT' },
    { firstName: 'Joseph', lastName: 'Lutalo', position: 'Bartender', level: 'L2', salary: 1500000, type: 'PERMANENT' },
    { firstName: 'Agnes', lastName: 'Nambi', position: 'Bar Assistant', level: 'L1', salary: 1100000, type: 'PERMANENT' },
    
    // Floor staff (L2/L1)
    { firstName: 'Patrick', lastName: 'Mukasa', position: 'Head Waiter', level: 'L2', salary: 1600000, type: 'PERMANENT' },
    { firstName: 'Alice', lastName: 'Nakalembe', position: 'Waiter', level: 'L1', salary: 1200000, type: 'PERMANENT' },
    { firstName: 'John', lastName: 'Kabanda', position: 'Waiter', level: 'L1', salary: 1200000, type: 'PERMANENT' },
    { firstName: 'Juliet', lastName: 'Namuyanja', position: 'Waiter', level: 'L1', salary: 1200000, type: 'PERMANENT' },
    { firstName: 'Steven', lastName: 'Wasswa', position: 'Waiter', level: 'L1', salary: 1200000, type: 'PERMANENT' },
    { firstName: 'Rose', lastName: 'Nansubuga', position: 'Waitress', level: 'L1', salary: 1200000, type: 'PERMANENT' },
    { firstName: 'Michael', lastName: 'Kato', position: 'Waiter', level: 'L1', salary: 1200000, type: 'CASUAL', status: 'ACTIVE' },
    { firstName: 'Rebecca', lastName: 'Nalwoga', position: 'Waitress', level: 'L1', salary: 1200000, type: 'CASUAL', status: 'ACTIVE' },
    
    // Cashiers (L2)
    { firstName: 'William', lastName: 'Ssekyewa', position: 'Head Cashier', level: 'L2', salary: 1800000, type: 'PERMANENT' },
    { firstName: 'Dorothy', lastName: 'Nakiwala', position: 'Cashier', level: 'L2', salary: 1400000, type: 'PERMANENT' },
    { firstName: 'Andrew', lastName: 'Kyagulanyi', position: 'Cashier', level: 'L2', salary: 1400000, type: 'PERMANENT' },
    
    // Stock/Inventory (L3)
    { firstName: 'Francis', lastName: 'Lubega', position: 'Stock Manager', level: 'L3', salary: 2200000, type: 'PERMANENT' },
    { firstName: 'Eva', lastName: 'Namusoke', position: 'Stock Clerk', level: 'L2', salary: 1300000, type: 'PERMANENT' },
    
    // Support staff (L1)
    { firstName: 'Daniel', lastName: 'Odongo', position: 'Cleaner', level: 'L1', salary: 900000, type: 'PERMANENT' },
    { firstName: 'Ruth', lastName: 'Namugosa', position: 'Cleaner', level: 'L1', salary: 900000, type: 'PERMANENT' },
    { firstName: 'Samuel', lastName: 'Kiyingi', position: 'Dishwasher', level: 'L1', salary: 950000, type: 'PERMANENT' },
    { firstName: 'Caroline', lastName: 'Namatovu', position: 'Security Guard', level: 'L1', salary: 1000000, type: 'PERMANENT' },
    { firstName: 'George', lastName: 'Musoke', position: 'Security Guard', level: 'L1', salary: 1000000, type: 'PERMANENT' },
    
    // Recently terminated (for realism)
    { firstName: 'Emmanuel', lastName: 'Babirye', position: 'Former Waiter', level: 'L1', salary: 1200000, type: 'PERMANENT', status: 'TERMINATED', terminatedDaysAgo: 45 },
    { firstName: 'Susan', lastName: 'Nankya', position: 'Former Bartender', level: 'L2', salary: 1500000, type: 'PERMANENT', status: 'TERMINATED', terminatedDaysAgo: 22 },
  ];
  
  let employeeCount = 0;
  let contractCount = 0;
  
  for (const emp of employeeData) {
    const hiredDate = new Date(TAPAS_START);
    hiredDate.setDate(hiredDate.getDate() - randomInt(200, 800)); // Hired 200-800 days ago
    
    const employee = await prisma.employee.create({
      data: {
        orgId: TAPAS_ORG_ID,
        branchId: TAPAS_BRANCH_ID,
        employeeCode: `TAPAS-EMP-${String(employeeCount + 1).padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        position: emp.position,
        employmentType: emp.type as any,
        status: emp.status === 'TERMINATED' ? 'TERMINATED' : 'ACTIVE',
        hiredAt: hiredDate,
        terminatedAt: emp.terminatedDaysAgo ? new Date(NOW.getTime() - emp.terminatedDaysAgo * 24 * 60 * 60 * 1000) : null,
      },
    });
    
    // Create employment contract
    await prisma.employmentContract.create({
      data: {
        employeeId: employee.id,
        orgId: TAPAS_ORG_ID,
        branchId: TAPAS_BRANCH_ID,
        salaryType: 'MONTHLY',
        baseSalary: new Prisma.Decimal(emp.salary),
        currency: 'UGX',
        workingDaysPerMonth: 22,
        workingHoursPerDay: 8,
        startDate: hiredDate,
        isPrimary: true,
      },
    });
    
    employeeCount++;
    contractCount++;
  }
  
  console.log(`  ✅ Created ${employeeCount} employees with ${contractCount} contracts`);
  return employeeCount;
}

/**
 * STEP 3: Seed Employees for Cafesserie (4 branches)
 */
async function seedCafesserieEmployees(prisma: PrismaClient) {
  console.log('👥 Seeding Cafesserie employees...');
  
  // Org-level staff
  const orgStaff = [
    { firstName: 'Jonathan', lastName: 'Kizza', position: 'Regional Manager', level: 'L5', salary: 6000000, branchId: null },
    { firstName: 'Patricia', lastName: 'Namuli', position: 'Finance Director', level: 'L4', salary: 4500000, branchId: null },
    { firstName: 'Vincent', lastName: 'Mukasa', position: 'Regional Procurement', level: 'L4', salary: 3500000, branchId: null },
  ];
  
  // Per-branch staff template
  const branchStaffTemplate = (branchName: string, scale: number) => [
    { position: 'Branch Manager', level: 'L4', salary: Math.floor(3200000 * scale), type: 'PERMANENT' },
    { position: 'Assistant Manager', level: 'L3', salary: Math.floor(2500000 * scale), type: 'PERMANENT' },
    { position: 'Head Barista', level: 'L3', salary: Math.floor(2200000 * scale), type: 'PERMANENT' },
    { position: 'Barista', level: 'L2', salary: Math.floor(1500000 * scale), type: 'PERMANENT' },
    { position: 'Barista', level: 'L2', salary: Math.floor(1500000 * scale), type: 'PERMANENT' },
    { position: 'Barista', level: 'L2', salary: Math.floor(1500000 * scale), type: 'CASUAL' },
    { position: 'Baker', level: 'L3', salary: Math.floor(1900000 * scale), type: 'PERMANENT' },
    { position: 'Kitchen Assistant', level: 'L2', salary: Math.floor(1300000 * scale), type: 'PERMANENT' },
    { position: 'Cashier', level: 'L2', salary: Math.floor(1400000 * scale), type: 'PERMANENT' },
    { position: 'Cashier', level: 'L2', salary: Math.floor(1400000 * scale), type: 'PERMANENT' },
    { position: 'Server', level: 'L1', salary: Math.floor(1200000 * scale), type: 'PERMANENT' },
    { position: 'Server', level: 'L1', salary: Math.floor(1200000 * scale), type: 'PERMANENT' },
    { position: 'Server', level: 'L1', salary: Math.floor(1200000 * scale), type: 'CASUAL' },
    { position: 'Cleaner', level: 'L1', salary: Math.floor(900000 * scale), type: 'PERMANENT' },
    { position: 'Security Guard', level: 'L1', salary: Math.floor(1000000 * scale), type: 'PERMANENT' },
  ];
  
  // Uganda first names
  const firstNames = ['John', 'Mary', 'Peter', 'Sarah', 'James', 'Grace', 'David', 'Betty', 'Moses', 'Agnes', 
                      'Robert', 'Catherine', 'Patrick', 'Alice', 'Joseph', 'Rose', 'Francis', 'Ruth', 'Daniel', 'Eva',
                      'Samuel', 'Dorothy', 'Isaac', 'Stella', 'William', 'Rebecca', 'Andrew', 'Juliet', 'Richard', 'Caroline'];
  
  const lastNames = ['Mukasa', 'Nakato', 'Ssemakula', 'Namukasa', 'Okello', 'Nabukalu', 'Kiiza', 'Akello', 
                     'Wandera', 'Nabirye', 'Mubiru', 'Nantongo', 'Lutalo', 'Nambi', 'Kabanda', 'Namuyanja',
                     'Wasswa', 'Nansubuga', 'Kato', 'Nalwoga', 'Ssekyewa', 'Nakiwala', 'Kyagulanyi', 'Lubega',
                     'Namusoke', 'Odongo', 'Namugosa', 'Kiyingi', 'Namatovu', 'Musoke'];
  
  let employeeCount = 0;
  let contractCount = 0;
  
  // Seed org-level staff
  for (const emp of orgStaff) {
    const hiredDate = new Date(CAF_START);
    hiredDate.setDate(hiredDate.getDate() - randomInt(300, 1000));
    
    const employee = await prisma.employee.create({
      data: {
        orgId: CAFESSERIE_ORG_ID,
        branchId: emp.branchId,
        employeeCode: `CAF-EMP-${String(employeeCount + 1).padStart(3, '0')}`,
        firstName: emp.firstName,
        lastName: emp.lastName,
        position: emp.position,
        employmentType: 'PERMANENT',
        status: 'ACTIVE',
        hiredAt: hiredDate,
      },
    });
    
    await prisma.employmentContract.create({
      data: {
        employeeId: employee.id,
        orgId: CAFESSERIE_ORG_ID,
        branchId: emp.branchId,
        salaryType: 'MONTHLY',
        baseSalary: new Prisma.Decimal(emp.salary),
        currency: 'UGX',
        workingDaysPerMonth: 22,
        workingHoursPerDay: 8,
        startDate: hiredDate,
        isPrimary: true,
      },
    });
    
    employeeCount++;
    contractCount++;
  }
  
  // Seed per-branch staff
  const branchScales = {
    'Village Mall': 1.1,  // Largest
    'Acacia Mall': 1.0,   // Standard
    'Arena Mall': 0.95,   // Slightly smaller
    'Mombasa': 0.9,       // Smallest
  };
  
  for (const [branchName, branchId] of Object.entries(CAF_BRANCHES)) {
    const scale = branchScales[branchName as keyof typeof branchScales];
    const staff = branchStaffTemplate(branchName, scale);
    
    for (const role of staff) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const hiredDate = new Date(CAF_START);
      hiredDate.setDate(hiredDate.getDate() - randomInt(150, 600));
      
      const employee = await prisma.employee.create({
        data: {
          orgId: CAFESSERIE_ORG_ID,
          branchId: branchId,
          employeeCode: `CAF-EMP-${String(employeeCount + 1).padStart(3, '0')}`,
          firstName,
          lastName,
          position: role.position,
          employmentType: role.type as any,
          status: 'ACTIVE',
          hiredAt: hiredDate,
        },
      });
      
      await prisma.employmentContract.create({
        data: {
          employeeId: employee.id,
          orgId: CAFESSERIE_ORG_ID,
          branchId: branchId,
          salaryType: 'MONTHLY',
          baseSalary: new Prisma.Decimal(role.salary),
          currency: 'UGX',
          workingDaysPerMonth: 22,
          workingHoursPerDay: 8,
          startDate: hiredDate,
          isPrimary: true,
        },
      });
      
      employeeCount++;
      contractCount++;
    }
    
    // Add 1-2 terminated staff per branch for realism
    const terminatedCount = randomInt(1, 2);
    for (let i = 0; i < terminatedCount; i++) {
      const firstName = randomElement(firstNames);
      const lastName = randomElement(lastNames);
      const hiredDate = new Date(CAF_START);
      hiredDate.setDate(hiredDate.getDate() - randomInt(180, 400));
      const terminatedDate = new Date(CAF_START);
      terminatedDate.setDate(terminatedDate.getDate() + randomInt(0, 120));
      
      const employee = await prisma.employee.create({
        data: {
          orgId: CAFESSERIE_ORG_ID,
          branchId: branchId,
          employeeCode: `CAF-EMP-${String(employeeCount + 1).padStart(3, '0')}`,
          firstName,
          lastName,
          position: randomElement(['Server', 'Barista', 'Cleaner']),
          employmentType: 'PERMANENT',
          status: 'TERMINATED',
          hiredAt: hiredDate,
          terminatedAt: terminatedDate,
        },
      });
      
      await prisma.employmentContract.create({
        data: {
          employeeId: employee.id,
          orgId: CAFESSERIE_ORG_ID,
          branchId: branchId,
          salaryType: 'MONTHLY',
          baseSalary: new Prisma.Decimal(1200000),
          currency: 'UGX',
          workingDaysPerMonth: 22,
          workingHoursPerDay: 8,
          startDate: hiredDate,
          endDate: terminatedDate,
          isPrimary: true,
        },
      });
      
      employeeCount++;
      contractCount++;
    }
  }
  
  console.log(`  ✅ Created ${employeeCount} employees with ${contractCount} contracts`);
  return employeeCount;
}

/**
 * STEP 4: Seed Service Providers + Contracts (both orgs)
 */
async function seedServiceProviders(prisma: PrismaClient) {
  console.log('🏢 Seeding service providers...');
  
  // Tapas providers
  const tapasProviders = [
    { name: 'Kampala Property Management', category: 'RENT', contactName: 'Mr. Ssali', phone: '+256-771-123456' },
    { name: 'Umeme Ltd', category: 'ELECTRICITY', contactName: 'Customer Service', phone: '+256-800-285463' },
    { name: 'National Water & Sewerage', category: 'WATER', contactName: 'Billing Dept', phone: '+256-417-123456' },
    { name: 'MTN Business', category: 'INTERNET', contactName: 'Support', phone: '+256-312-100200' },
    { name: 'SecureGuard Uganda', category: 'SECURITY', contactName: 'Operations', phone: '+256-771-999888' },
    { name: 'CleanPro Services', category: 'CLEANING', contactName: 'Manager', phone: '+256-772-888777' },
  ];
  
  let contractCount = 0;
  
  for (const prov of tapasProviders) {
    const provider = await prisma.serviceProvider.create({
      data: {
        orgId: TAPAS_ORG_ID,
        branchId: TAPAS_BRANCH_ID,
        name: prov.name,
        category: prov.category as any,
        contactName: prov.contactName,
        contactPhone: prov.phone,
        isActive: true,
      },
    });
    
    // Create monthly contract
    const monthlyAmounts: Record<string, number> = {
      RENT: 12000000,  // 12M UGX/month
      ELECTRICITY: randomInt(2500000, 4500000),
      WATER: randomInt(800000, 1500000),
      INTERNET: 450000,
      SECURITY: 2200000,
      CLEANING: 1800000,
    };
    
    await prisma.serviceContract.create({
      data: {
        providerId: provider.id,
        branchId: TAPAS_BRANCH_ID,
        frequency: 'MONTHLY',
        amount: new Prisma.Decimal(monthlyAmounts[prov.category] || 1000000),
        currency: 'UGX',
        dueDay: prov.category === 'RENT' ? 1 : randomInt(5, 25),
        startDate: TAPAS_START,
        status: 'ACTIVE',
      },
    });
    
    contractCount++;
  }
  
  // Cafesserie providers (per branch + org-level)
  const cafOrgProviders = [
    { name: 'Capital Coffee Importers', category: 'OTHER', contactName: 'Sales', phone: '+256-414-567890', branchId: null },
  ];
  
  for (const prov of cafOrgProviders) {
    const provider = await prisma.serviceProvider.create({
      data: {
        orgId: CAFESSERIE_ORG_ID,
        branchId: prov.branchId,
        name: prov.name,
        category: prov.category as any,
        contactName: prov.contactName,
        contactPhone: prov.phone,
        isActive: true,
      },
    });
  }
  
  // Per-branch providers for Cafesserie
  for (const [branchName, branchId] of Object.entries(CAF_BRANCHES)) {
    const branchProviders = [
      { name: `${branchName} Landlord`, category: 'RENT' },
      { name: 'Umeme Ltd', category: 'ELECTRICITY' },
      { name: 'National Water & Sewerage', category: 'WATER' },
      { name: 'Airtel Business', category: 'INTERNET' },
      { name: 'Guardian Security', category: 'SECURITY' },
    ];
    
    const rentAmounts: Record<string, number> = {
      'Village Mall': 8500000,
      'Acacia Mall': 9000000,
      'Arena Mall': 7500000,
      'Mombasa': 6000000,
    };
    
    for (const prov of branchProviders) {
      const provider = await prisma.serviceProvider.create({
        data: {
          orgId: CAFESSERIE_ORG_ID,
          branchId: branchId,
          name: prov.name,
          category: prov.category as any,
          contactName: 'Manager',
          contactPhone: `+256-77${randomInt(1000000, 9999999)}`,
          isActive: true,
        },
      });
      
      const monthlyAmounts: Record<string, number> = {
        RENT: rentAmounts[branchName as keyof typeof rentAmounts] || 7000000,
        ELECTRICITY: randomInt(1500000, 3000000),
        WATER: randomInt(500000, 1000000),
        INTERNET: 400000,
        SECURITY: 1800000,
      };
      
      if (prov.category !== 'OTHER') {
        await prisma.serviceContract.create({
          data: {
            providerId: provider.id,
            branchId: branchId,
            frequency: 'MONTHLY',
            amount: new Prisma.Decimal(monthlyAmounts[prov.category] || 1000000),
            currency: 'UGX',
            dueDay: prov.category === 'RENT' ? 1 : randomInt(5, 25),
            startDate: CAF_START,
            status: 'ACTIVE',
          },
        });
        
        contractCount++;
      }
    }
  }
  
  console.log(`  ✅ Created service providers with ${contractCount} contracts`);
  return contractCount;
}

/**
 * STEP 5: Seed Vendors + Bills + Payments
 */
async function seedVendorsAndBills(prisma: PrismaClient) {
  console.log('📦 Seeding vendors, bills, and payments...');
  
  // Tapas vendors
  const tapasVendors = [
    { name: 'Fresh Foods Uganda', email: 'orders@freshfoods.ug', phone: '+256-772-111222', terms: 'NET30' },
    { name: 'Quality Meats Ltd', email: 'sales@qualitymeats.co.ug', phone: '+256-772-222333', terms: 'NET30' },
    { name: 'UG Dairy Supplies', email: 'orders@ugdairy.com', phone: '+256-772-333444', terms: 'NET30' },
    { name: 'Bell Lager Distributors', email: 'b2b@bell.ug', phone: '+256-772-444555', terms: 'NET14' },
    { name: 'Wines & Spirits Co.', email: 'wholesale@wines.co.ug', phone: '+256-772-555666', terms: 'NET14' },
  ];
  
  let billCount = 0;
  let paymentCount = 0;
  
  for (const vend of tapasVendors) {
    const vendor = await prisma.vendor.create({
      data: {
        orgId: TAPAS_ORG_ID,
        name: vend.name,
        email: vend.email,
        phone: vend.phone,
        defaultTerms: vend.terms as any,
      },
    });
    
    // Create 3-6 monthly bills
    const numBills = randomInt(3, 6);
    for (let i = 0; i < numBills; i++) {
      const billDate = new Date(TAPAS_START);
      billDate.setDate(billDate.getDate() + i * 25 + randomInt(0, 10));
      
      const dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + (vend.terms === 'NET14' ? 14 : 30));
      
      const subtotal = randomInt(1500000, 8000000);
      const tax = subtotal * 0.18;
      const total = subtotal + tax;
      
      const isPaid = billDate < new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000) && seededRng.next() > 0.1;
      
      const bill = await prisma.vendorBill.create({
        data: {
          orgId: TAPAS_ORG_ID,
          vendorId: vendor.id,
          number: `INV-${vendor.name.substring(0, 3).toUpperCase()}-${billCount + 1}`,
          billDate: billDate,
          dueDate: dueDate,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(tax),
          total: new Prisma.Decimal(total),
          status: isPaid ? 'PAID' : 'OPEN',
        },
      });
      
      billCount++;
      
      // Create payment if paid
      if (isPaid) {
        const paidDate = new Date(dueDate);
        paidDate.setDate(paidDate.getDate() - randomInt(0, 7));
        
        await prisma.vendorPayment.create({
          data: {
            orgId: TAPAS_ORG_ID,
            vendorId: vendor.id,
            billId: bill.id,
            amount: new Prisma.Decimal(total),
            paidAt: paidDate,
            method: randomElement(['BANK', 'MOMO', 'CASH']),
            ref: `PAY-${randomInt(1000, 9999)}`,
          },
        });
        
        paymentCount++;
      }
    }
  }
  
  // Cafesserie vendors (shared across branches)
  const cafVendors = [
    { name: 'Uganda Coffee Traders', email: 'b2b@ugcoffee.com', phone: '+256-772-777888', terms: 'NET30' },
    { name: 'Kampala Bakery Supplies', email: 'orders@kbsupplies.ug', phone: '+256-772-888999', terms: 'NET30' },
    { name: 'Fresh Milk Cooperative', email: 'wholesale@freshmilk.co.ug', phone: '+256-772-999000', terms: 'NET14' },
    { name: 'Café Equipment Ltd', email: 'sales@cafeequip.com', phone: '+256-772-000111', terms: 'NET30' },
  ];
  
  for (const vend of cafVendors) {
    const vendor = await prisma.vendor.create({
      data: {
        orgId: CAFESSERIE_ORG_ID,
        name: vend.name,
        email: vend.email,
        phone: vend.phone,
        defaultTerms: vend.terms as any,
      },
    });
    
    // Create 4-8 bills over 180 days
    const numBills = randomInt(4, 8);
    for (let i = 0; i < numBills; i++) {
      const billDate = new Date(CAF_START);
      billDate.setDate(billDate.getDate() + i * 22 + randomInt(0, 10));
      
      const dueDate = new Date(billDate);
      dueDate.setDate(dueDate.getDate() + (vend.terms === 'NET14' ? 14 : 30));
      
      const subtotal = randomInt(2000000, 12000000);
      const tax = subtotal * 0.18;
      const total = subtotal + tax;
      
      const isPaid = billDate < new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000) && seededRng.next() > 0.08;
      
      const bill = await prisma.vendorBill.create({
        data: {
          orgId: CAFESSERIE_ORG_ID,
          vendorId: vendor.id,
          number: `INV-${vendor.name.substring(0, 3).toUpperCase()}-${billCount + 1}`,
          billDate: billDate,
          dueDate: dueDate,
          subtotal: new Prisma.Decimal(subtotal),
          tax: new Prisma.Decimal(tax),
          total: new Prisma.Decimal(total),
          status: isPaid ? 'PAID' : 'OPEN',
        },
      });
      
      billCount++;
      
      if (isPaid) {
        const paidDate = new Date(dueDate);
        paidDate.setDate(paidDate.getDate() - randomInt(0, 7));
        
        await prisma.vendorPayment.create({
          data: {
            orgId: CAFESSERIE_ORG_ID,
            vendorId: vendor.id,
            billId: bill.id,
            amount: new Prisma.Decimal(total),
            paidAt: paidDate,
            method: randomElement(['BANK', 'MOMO', 'CASH']),
            ref: `PAY-${randomInt(1000, 9999)}`,
          },
        });
        
        paymentCount++;
      }
    }
  }
  
  console.log(`  ✅ Created ${billCount} bills with ${paymentCount} payments`);
  return { billCount, paymentCount };
}

/**
 * STEP 6: Seed Reservations (Tapas focus)
 */
async function seedReservations(prisma: PrismaClient) {
  console.log('📅 Seeding reservations for Tapas...');
  
  const customerNames = [
    'John Mugisha', 'Sarah Nakato', 'David Okello', 'Grace Namukasa', 'Peter Ssemakula',
    'Mary Nabukalu', 'James Kiiza', 'Betty Akello', 'Robert Mubiru', 'Catherine Nantongo',
    'Patrick Mukasa', 'Alice Nakalembe', 'Joseph Lutalo', 'Rose Nansubuga', 'William Ssekyewa',
    'Dorothy Nakiwala', 'Francis Lubega', 'Eva Namusoke', 'Daniel Odongo', 'Ruth Namugosa',
  ];
  
  let reservationCount = 0;
  let confirmedCount = 0;
  let cancelledCount = 0;
  let noShowCount = 0;
  
  // Create 8-25 reservations per week for 90 days (~13 weeks)
  const weeks = 13;
  for (let week = 0; week < weeks; week++) {
    const reservationsThisWeek = randomInt(8, 25);
    
    for (let i = 0; i < reservationsThisWeek; i++) {
      const dayOffset = week * 7 + randomInt(0, 6);
      const resDate = new Date(TAPAS_START);
      resDate.setDate(resDate.getDate() + dayOffset);
      
      // More reservations Thu-Sun
      const dayOfWeek = resDate.getDay();
      if (dayOfWeek < 4 && seededRng.next() < 0.6) continue; // Skip some weekday reservations
      
      const hour = randomInt(18, 22); // 6pm-10pm
      const minute = randomElement([0, 15, 30, 45]);
      resDate.setHours(hour, minute, 0, 0);
      
      const endDate = new Date(resDate);
      endDate.setHours(hour + 2, minute, 0, 0);
      
      const partySize = randomInt(2, 12);
      const needsDeposit = partySize >= 6;
      
      // Status distribution - use new M9.1 statuses
      let status: string;
      let depositAmt = 0;
      let source: string = 'PHONE';
      let seatedAt: Date | null = null;
      let completedAt: Date | null = null;
      let cancellationReason: string | null = null;
      
      // Random source
      const sourceRand = seededRng.next();
      if (sourceRand < 0.5) source = 'PHONE';
      else if (sourceRand < 0.75) source = 'ONLINE';
      else if (sourceRand < 0.9) source = 'WALK_IN';
      else source = 'INTERNAL';
      
      if (resDate < new Date(NOW.getTime() - 7 * 24 * 60 * 60 * 1000)) {
        // Past reservation
        const rand = seededRng.next();
        if (rand < 0.70) {
          status = 'COMPLETED'; // M9.1: Use COMPLETED for finished reservations
          seatedAt = new Date(resDate.getTime() + 10 * 60 * 1000); // Seated 10 min after start
          completedAt = new Date(seatedAt.getTime() + 90 * 60 * 1000); // Completed 90 min later
          confirmedCount++;
        } else if (rand < 0.85) {
          status = 'CANCELLED';
          cancellationReason = randomElement(['Customer request', 'Schedule conflict', 'Weather', 'No answer']);
          cancelledCount++;
        } else {
          status = 'NO_SHOW'; // M9.1: Use NO_SHOW instead of CANCELLED
          cancellationReason = 'Customer did not arrive';
          noShowCount++;
        }
      } else if (resDate < NOW) {
        // Current day - some seated
        status = 'SEATED';
        seatedAt = new Date(resDate.getTime() + 5 * 60 * 1000);
        confirmedCount++;
      } else {
        // Future reservation
        status = 'CONFIRMED';
        confirmedCount++;
      }
      
      if (needsDeposit && !['CANCELLED', 'NO_SHOW'].includes(status)) {
        depositAmt = partySize * 50000; // 50k per person
      }
      
      const notes = seededRng.next() < 0.3 ? randomElement([
        'Birthday celebration',
        'Anniversary dinner',
        'Business meeting',
        'Window seat preferred',
        'Allergies: nuts',
        'Quiet area please',
        'Vegetarian options needed',
      ]) : null;
      
      await prisma.reservation.create({
        data: {
          orgId: TAPAS_ORG_ID,
          branchId: TAPAS_BRANCH_ID,
          name: randomElement(customerNames),
          phone: `+256-77${randomInt(1000000, 9999999)}`,
          partySize: partySize,
          startAt: resDate,
          endAt: endDate,
          status: status as any,
          source: source as any,
          notes: notes,
          cancellationReason: cancellationReason,
          seatedAt: seatedAt,
          completedAt: completedAt,
          deposit: new Prisma.Decimal(depositAmt),
          depositStatus: depositAmt > 0 ? 'CAPTURED' : 'NONE',
        },
      });
      
      reservationCount++;
    }
  }
  
  console.log(`  ✅ Created ${reservationCount} reservations`);
  console.log(`     - Confirmed/Seated: ${confirmedCount}`);
  console.log(`     - Cancelled: ${cancelledCount}`);
  console.log(`     - No-shows: ${noShowCount}`);
  
  return reservationCount;
}

/**
 * STEP 6B: Seed Waitlist (M9.1)
 */
async function seedWaitlist(prisma: PrismaClient) {
  console.log('📋 Seeding waitlist entries...');
  
  const customerNames = [
    'John Mugisha', 'Sarah Nakato', 'David Okello', 'Grace Namukasa', 'Peter Ssemakula',
    'Mary Nabukalu', 'James Kiiza', 'Betty Akello', 'Robert Mubiru', 'Catherine Nantongo',
  ];
  
  let waitingCount = 0;
  let seatedCount = 0;
  let droppedCount = 0;
  
  // Create waitlist entries for the past week
  for (let day = 0; day < 7; day++) {
    const entriesPerDay = randomInt(3, 8);
    
    for (let i = 0; i < entriesPerDay; i++) {
      const entryDate = new Date(NOW);
      entryDate.setDate(entryDate.getDate() - day);
      entryDate.setHours(randomInt(18, 21), randomInt(0, 59), 0, 0);
      
      const partySize = randomInt(2, 6);
      const quotedWait = randomInt(10, 45);
      
      let status: string;
      let seatedAt: Date | null = null;
      let droppedAt: Date | null = null;
      let droppedReason: string | null = null;
      
      if (day === 0) {
        // Today: some still waiting
        if (i < 2) {
          status = 'WAITING';
          waitingCount++;
        } else {
          status = 'SEATED';
          seatedAt = new Date(entryDate.getTime() + quotedWait * 60 * 1000);
          seatedCount++;
        }
      } else {
        // Past days: mostly seated or dropped
        const rand = seededRng.next();
        if (rand < 0.75) {
          status = 'SEATED';
          seatedAt = new Date(entryDate.getTime() + quotedWait * 60 * 1000);
          seatedCount++;
        } else {
          status = 'DROPPED';
          droppedAt = new Date(entryDate.getTime() + randomInt(15, 30) * 60 * 1000);
          droppedReason = randomElement(['Left voluntarily', 'Wait too long', 'Called away', 'No answer']);
          droppedCount++;
        }
      }
      
      const notes = seededRng.next() < 0.2 ? randomElement([
        'High chair needed',
        'Wheelchair access',
        'Birthday surprise',
        'Prefers patio',
      ]) : null;
      
      await prisma.waitlistEntry.create({
        data: {
          orgId: TAPAS_ORG_ID,
          branchId: TAPAS_BRANCH_ID,
          name: randomElement(customerNames),
          phone: `+256-77${randomInt(1000000, 9999999)}`,
          partySize: partySize,
          quotedWaitMinutes: quotedWait,
          status: status as any,
          notes: notes,
          seatedAt: seatedAt,
          droppedAt: droppedAt,
          droppedReason: droppedReason,
          createdAt: entryDate,
        },
      });
    }
  }
  
  console.log(`  ✅ Created ${waitingCount + seatedCount + droppedCount} waitlist entries`);
  console.log(`     - Waiting: ${waitingCount}`);
  console.log(`     - Seated: ${seatedCount}`);
  console.log(`     - Dropped: ${droppedCount}`);
  
  return { waitingCount, seatedCount, droppedCount };
}

/**
 * STEP 7: Seed Customer Feedback/NPS
 */
async function seedFeedback(prisma: PrismaClient) {
  console.log('⭐ Seeding customer feedback...');
  
  const channels: string[] = ['POS', 'QR', 'EMAIL', 'SMS', 'PORTAL'];
  const positiveTags = ['great_food', 'excellent_service', 'good_value', 'clean', 'fast'];
  const negativeTags = ['slow_service', 'cold_food', 'noisy', 'expensive', 'dirty'];
  const neutralTags = ['average', 'okay', 'acceptable'];
  
  const positiveComments = [
    'Amazing food and service!',
    'Best restaurant in Kampala!',
    'Will definitely come back.',
    'Loved the ambience.',
    'Great value for money.',
    'Staff were very professional.',
    'Food was delicious!',
    'Quick service, impressive.',
    'Highly recommend!',
  ];
  
  const neutralComments = [
    'It was okay.',
    'Average experience.',
    'Food was good, service slow.',
    'Decent place.',
    'Nothing special but fine.',
  ];
  
  const negativeComments = [
    'Service was too slow.',
    'Food arrived cold.',
    'Too noisy, couldn\'t hear.',
    'Overpriced for what you get.',
    'Not clean enough.',
    'Staff seemed rushed.',
    'Disappointed with quality.',
  ];
  
  let tapasFeedbackCount = 0;
  let cafFeedbackCount = 0;
  
  // Tapas: 300-900 feedback over 90 days
  const tapasFeedbackTarget = randomInt(300, 900);
  const tapasFeedbackPerDay = tapasFeedbackTarget / 90;
  
  for (let day = 0; day < 90; day++) {
    const feedbackToday = Math.round(tapasFeedbackPerDay + (seededRng.next() - 0.5) * 5);
    
    for (let i = 0; i < feedbackToday; i++) {
      const feedbackDate = new Date(TAPAS_START);
      feedbackDate.setDate(feedbackDate.getDate() + day);
      feedbackDate.setHours(randomInt(10, 22), randomInt(0, 59), 0, 0);
      
      // Mild improvement trend over time
      const improvementFactor = day / 90 * 0.15; // +15% improvement by day 90
      let score = randomInt(0, 10);
      if (seededRng.next() < improvementFactor) {
        score = Math.min(10, score + randomInt(1, 2));
      }
      
      const npsCategory = score >= 9 ? 'PROMOTER' : (score >= 7 ? 'PASSIVE' : 'DETRACTOR');
      
      let tags: string[];
      let comment: string | null;
      
      if (score >= 8) {
        tags = shuffle(positiveTags).slice(0, randomInt(1, 3));
        comment = seededRng.next() < 0.7 ? randomElement(positiveComments) : null;
      } else if (score >= 5) {
        tags = shuffle(neutralTags).slice(0, randomInt(1, 2));
        comment = seededRng.next() < 0.4 ? randomElement(neutralComments) : null;
      } else {
        tags = shuffle(negativeTags).slice(0, randomInt(1, 3));
        comment = seededRng.next() < 0.8 ? randomElement(negativeComments) : null;
      }
      
      await prisma.feedback.create({
        data: {
          orgId: TAPAS_ORG_ID,
          branchId: TAPAS_BRANCH_ID,
          channel: randomElement(channels) as any,
          score: score,
          npsCategory: npsCategory as any,
          comment: comment,
          tags: tags,
          createdAt: feedbackDate,
        },
      });
      
      tapasFeedbackCount++;
    }
  }
  
  // Cafesserie: 2,000-6,000 feedback over 180 days across 4 branches
  const cafFeedbackTarget = randomInt(2000, 6000);
  const cafFeedbackPerDay = cafFeedbackTarget / 180;
  
  const branchWeights = {
    'Village Mall': 0.30,  // 30% of feedback
    'Acacia Mall': 0.28,   // 28%
    'Arena Mall': 0.24,    // 24%
    'Mombasa': 0.18,       // 18%
  };
  
  // Branch-specific quality bias (for leaderboard differentiation)
  const branchQualityBoost = {
    'Village Mall': 0.10,  // Best performing
    'Acacia Mall': 0.05,   // Good
    'Arena Mall': 0.00,    // Average
    'Mombasa': -0.05,      // Needs improvement
  };
  
  for (let day = 0; day < 180; day++) {
    const feedbackToday = Math.round(cafFeedbackPerDay + (seededRng.next() - 0.5) * 10);
    
    for (let i = 0; i < feedbackToday; i++) {
      const feedbackDate = new Date(CAF_START);
      feedbackDate.setDate(feedbackDate.getDate() + day);
      feedbackDate.setHours(randomInt(7, 20), randomInt(0, 59), 0, 0);
      
      // Assign to branch based on weights
      const branchRoll = seededRng.next();
      let cumulative = 0;
      let selectedBranch = 'Village Mall';
      let selectedBranchId = CAF_BRANCHES['Village Mall'];
      
      for (const [branch, weight] of Object.entries(branchWeights)) {
        cumulative += weight;
        if (branchRoll < cumulative) {
          selectedBranch = branch;
          selectedBranchId = CAF_BRANCHES[branch as keyof typeof CAF_BRANCHES];
          break;
        }
      }
      
      // Score with branch quality bias + improvement trend
      const improvementFactor = day / 180 * 0.12; // +12% improvement by day 180
      const qualityBoost = branchQualityBoost[selectedBranch as keyof typeof branchQualityBoost];
      
      let score = randomInt(0, 10);
      if (seededRng.next() < (improvementFactor + qualityBoost)) {
        score = Math.min(10, score + randomInt(1, 2));
      }
      if (qualityBoost < 0 && seededRng.next() < Math.abs(qualityBoost)) {
        score = Math.max(0, score - 1);
      }
      
      const npsCategory = score >= 9 ? 'PROMOTER' : (score >= 7 ? 'PASSIVE' : 'DETRACTOR');
      
      let tags: string[];
      let comment: string | null;
      
      if (score >= 8) {
        tags = shuffle(positiveTags).slice(0, randomInt(1, 3));
        comment = seededRng.next() < 0.6 ? randomElement(positiveComments) : null;
      } else if (score >= 5) {
        tags = shuffle(neutralTags).slice(0, randomInt(1, 2));
        comment = seededRng.next() < 0.3 ? randomElement(neutralComments) : null;
      } else {
        tags = shuffle(negativeTags).slice(0, randomInt(1, 3));
        comment = seededRng.next() < 0.7 ? randomElement(negativeComments) : null;
      }
      
      await prisma.feedback.create({
        data: {
          orgId: CAFESSERIE_ORG_ID,
          branchId: selectedBranchId,
          channel: randomElement(channels) as any,
          score: score,
          npsCategory: npsCategory as any,
          comment: comment,
          tags: tags,
          createdAt: feedbackDate,
        },
      });
      
      cafFeedbackCount++;
    }
  }
  
  console.log(`  ✅ Created ${tapasFeedbackCount + cafFeedbackCount} feedback records`);
  console.log(`     - Tapas: ${tapasFeedbackCount}`);
  console.log(`     - Cafesserie: ${cafFeedbackCount}`);
  
  return { tapasFeedbackCount, cafFeedbackCount };
}

/**
 * Main seeder function
 */
export async function seedOperations(prisma: PrismaClient) {
  console.log('═══════════════════════════════════════════');
  console.log('🎯 Milestone 5: Operational Data Seeding');
  console.log('═══════════════════════════════════════════\n');
  
  await cleanupOperationalData(prisma);
  
  const tapasEmployees = await seedTapasEmployees(prisma);
  const cafEmployees = await seedCafesserieEmployees(prisma);
  
  const contracts = await seedServiceProviders(prisma);
  const { billCount, paymentCount } = await seedVendorsAndBills(prisma);
  const reservations = await seedReservations(prisma);
  const waitlist = await seedWaitlist(prisma);
  const { tapasFeedbackCount, cafFeedbackCount } = await seedFeedback(prisma);
  
  console.log('\n═══════════════════════════════════════════');
  console.log('✅ Operational Data Seeding Complete');
  console.log('═══════════════════════════════════════════');
  console.log(`📊 Summary:`);
  console.log(`  Employees: ${tapasEmployees + cafEmployees}`);
  console.log(`    - Tapas: ${tapasEmployees}`);
  console.log(`    - Cafesserie: ${cafEmployees}`);
  console.log(`  Service Contracts: ${contracts}`);
  console.log(`  Vendor Bills: ${billCount} (${paymentCount} paid)`);
  console.log(`  Reservations: ${reservations} (Tapas only)`);
  console.log(`  Waitlist: ${waitlist.waitingCount + waitlist.seatedCount + waitlist.droppedCount}`);
  console.log(`  Feedback: ${tapasFeedbackCount + cafFeedbackCount}`);
  console.log(`    - Tapas: ${tapasFeedbackCount}`);
  console.log(`    - Cafesserie: ${cafFeedbackCount}`);
  console.log('═══════════════════════════════════════════\n');
}
