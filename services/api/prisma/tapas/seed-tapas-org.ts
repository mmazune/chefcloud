import { PrismaClient, Org, Branch, User } from '@prisma/client';
import * as argon2 from 'argon2';

async function hashPassword(password: string): Promise<string> {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
}

interface TapasStaffMember {
  user: User;
  branchId: string;
}

interface TapasOrgResult {
  org: Org;
  branches: {
    cbd: Branch;
    kololo: Branch;
  };
  staff: {
    owner: TapasStaffMember;
    manager: TapasStaffMember;
    assistant: TapasStaffMember;
    accountant: TapasStaffMember;
    chef: TapasStaffMember;
    stock: TapasStaffMember;
    waiter: TapasStaffMember;
    waiterKololo: TapasStaffMember;
    kds: TapasStaffMember;
    dev: TapasStaffMember;
  };
}

export async function seedTapasDemoOrg(
  prisma: PrismaClient,
): Promise<TapasOrgResult> {
  console.log('\n🥘 Seeding Tapas Demo Org...');

  // 1. Create/update Tapas org
  let org = await prisma.org.findUnique({
    where: { slug: 'tapas-demo' },
  });

  if (!org) {
    org = await prisma.org.create({
      data: {
        name: 'Tapas Kampala',
        slug: 'tapas-demo',
        isDemo: true,
      },
    });
    console.log(`  ✅ Created org: ${org.name}`);
  } else {
    org = await prisma.org.update({
      where: { id: org.id },
      data: { isDemo: true },
    });
    console.log(`  ✅ Updated org: ${org.name}`);
  }

  // Create org settings
  await prisma.orgSettings.upsert({
    where: { orgId: org.id },
    update: {
      vatPercent: 18.0,
      currency: 'UGX',
      timezone: 'Africa/Kampala',
    },
    create: {
      orgId: org.id,
      vatPercent: 18.0,
      currency: 'UGX',
      timezone: 'Africa/Kampala',
      platformAccess: {
        WAITER: { desktop: true, web: false, mobile: false },
        CASHIER: { desktop: true, web: false, mobile: false },
        SUPERVISOR: { desktop: true, web: false, mobile: false },
        HEAD_CHEF: { desktop: true, web: false, mobile: true },
        ASSISTANT_CHEF: { desktop: true, web: false, mobile: true },
        HEAD_BARISTA: { desktop: true, web: false, mobile: true },
        STOCK: { desktop: false, web: true, mobile: true },
        PROCUREMENT: { desktop: false, web: true, mobile: true },
        ASSISTANT_MANAGER: { desktop: false, web: true, mobile: true },
        EVENT_MANAGER: { desktop: false, web: true, mobile: true },
        TICKET_MASTER: { desktop: true, web: false, mobile: false },
        MANAGER: { desktop: false, web: true, mobile: true },
        ACCOUNTANT: { desktop: false, web: true, mobile: true },
        OWNER: { desktop: false, web: true, mobile: true },
        DEV_ADMIN: { desktop: false, web: true, mobile: false },
        CHEF: { desktop: true, web: false, mobile: true },
        ADMIN: { desktop: false, web: true, mobile: true },
      },
    },
  });

  // 2. Create branches
  const cbd = await prisma.branch.upsert({
    where: {
      orgId_name: {
        orgId: org.id,
        name: 'Tapas – Kampala CBD',
      },
    },
    update: {
      address: 'Plot 123, Kampala Road, Kampala',
      timezone: 'Africa/Kampala',
      capacity: 80,
    },
    create: {
      orgId: org.id,
      name: 'Tapas – Kampala CBD',
      address: 'Plot 123, Kampala Road, Kampala',
      timezone: 'Africa/Kampala',
      capacity: 80,
    },
  });
  console.log(`  ✅ Created branch: ${cbd.name}`);

  const kololo = await prisma.branch.upsert({
    where: {
      orgId_name: {
        orgId: org.id,
        name: 'Tapas – Kololo Rooftop',
      },
    },
    update: {
      address: 'Plot 456, Kololo Hill, Kampala',
      timezone: 'Africa/Kampala',
      capacity: 60,
    },
    create: {
      orgId: org.id,
      name: 'Tapas – Kololo Rooftop',
      address: 'Plot 456, Kololo Hill, Kampala',
      timezone: 'Africa/Kampala',
      capacity: 60,
    },
  });
  console.log(`  ✅ Created branch: ${kololo.name}`);

  // 3. Seed staff and demo accounts
  const staff = await seedTapasStaff(prisma, org, { cbd, kololo });

  return { org, branches: { cbd, kololo }, staff };
}

async function seedTapasStaff(
  prisma: PrismaClient,
  org: Org,
  branches: { cbd: Branch; kololo: Branch },
) {
  console.log('  👥 Seeding Tapas staff...');

  const password = 'TapasDemo!123';

  // Define all staff members
  const staffMembers = [
    {
      email: 'owner@tapas.demo',
      name: 'Sarah Nakato',
      roleLevel: 'L5',
      branchId: branches.cbd.id,
      employeeCode: 'OWNER001',
      key: 'owner',
    },
    {
      email: 'manager@tapas.demo',
      name: 'John Mugisha',
      roleLevel: 'L4',
      branchId: branches.cbd.id,
      employeeCode: 'MGR001',
      key: 'manager',
    },
    {
      email: 'assistant@tapas.demo',
      name: 'Grace Nambi',
      roleLevel: 'L3',
      branchId: branches.cbd.id,
      employeeCode: 'AMGR001',
      key: 'assistant',
    },
    {
      email: 'accountant@tapas.demo',
      name: 'David Okello',
      roleLevel: 'L4',
      branchId: branches.cbd.id,
      employeeCode: 'ACC001',
      key: 'accountant',
    },
    {
      email: 'chef@tapas.demo',
      name: 'Maria Santos',
      roleLevel: 'L2',
      branchId: branches.cbd.id,
      employeeCode: 'CHEF001',
      key: 'chef',
    },
    {
      email: 'stock@tapas.demo',
      name: 'Peter Wanyama',
      roleLevel: 'L3',
      branchId: branches.cbd.id,
      employeeCode: 'STOCK001',
      key: 'stock',
    },
    {
      email: 'waiter@tapas.demo',
      name: 'Asha Tumusiime',
      roleLevel: 'L1',
      branchId: branches.cbd.id,
      employeeCode: 'W001',
      key: 'waiter',
    },
    {
      email: 'waiter.kololo@tapas.demo',
      name: 'Brian Kasozi',
      roleLevel: 'L1',
      branchId: branches.kololo.id,
      employeeCode: 'W002',
      key: 'waiterKololo',
    },
    {
      email: 'kds@tapas.demo',
      name: 'Ruth Nakimuli',
      roleLevel: 'L1',
      branchId: branches.cbd.id,
      employeeCode: 'KDS001',
      key: 'kds',
    },
    {
      email: 'dev@tapas.demo',
      name: 'Isaac Byaruhanga',
      roleLevel: 'L5',
      branchId: branches.cbd.id,
      employeeCode: 'DEV001',
      key: 'dev',
    },
  ];

  const staff: Record<string, TapasStaffMember> = {};

  for (const member of staffMembers) {
    const passwordHash = await hashPassword(password);

    const user = await prisma.user.upsert({
      where: { email: member.email },
      update: {
        passwordHash,
        firstName: member.name.split(' ')[0],
        lastName: member.name.split(' ').slice(1).join(' '),
        roleLevel: member.roleLevel as 'L1' | 'L2' | 'L3' | 'L4' | 'L5',
        orgId: org.id,
        branchId: member.branchId,
        employeeCode: member.employeeCode,
      },
      create: {
        email: member.email,
        passwordHash,
        firstName: member.name.split(' ')[0],
        lastName: member.name.split(' ').slice(1).join(' '),
        roleLevel: member.roleLevel as 'L1' | 'L2' | 'L3' | 'L4' | 'L5',
        orgId: org.id,
        branchId: member.branchId,
        employeeCode: member.employeeCode,
      },
    });

    staff[member.key] = {
      user,
      branchId: member.branchId,
    };

    console.log(`    ✅ ${member.name} (${member.email})`);
  }

  return staff as TapasOrgResult['staff'];
}
