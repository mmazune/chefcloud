#!/usr/bin/env node
/**
 * Production User Creation Script (One-off Admin Tool)
 * 
 * Creates a demo user in production database for testing cross-domain auth.
 * 
 * SECURITY: Guarded by ALLOW_CREATE_PROD_USER=true env var
 * 
 * Usage:
 *   ALLOW_CREATE_PROD_USER=true node scripts/create-prod-user.js
 * 
 * Prompts for:
 *   - Email
 *   - Password (hidden)
 *   - Role level (default: L5/Owner)
 *   - Org slug (default: demo-restaurant)
 */

const { PrismaClient } = require('@prisma/client');
const argon2 = require('argon2');
const readline = require('readline');

// Security guard
if (process.env.ALLOW_CREATE_PROD_USER !== 'true') {
  console.error('');
  console.error('ERROR: This script requires ALLOW_CREATE_PROD_USER=true');
  console.error('');
  console.error('This is a safeguard to prevent accidental production user creation.');
  console.error('');
  console.error('Usage:');
  console.error('  ALLOW_CREATE_PROD_USER=true node scripts/create-prod-user.js');
  console.error('');
  process.exit(1);
}

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: true,
});

function question(prompt) {
  return new Promise((resolve) => {
    rl.question(prompt, (answer) => {
      resolve(answer.trim());
    });
  });
}

function questionHidden(prompt) {
  return new Promise((resolve) => {
    const stdin = process.stdin;
    const stdout = process.stdout;

    stdout.write(prompt);

    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');

    let password = '';
    const onData = (char) => {
      char = char.toString('utf8');

      switch (char) {
        case '\n':
        case '\r':
        case '\u0004': // Ctrl-D
          stdin.setRawMode(false);
          stdin.pause();
          stdin.removeListener('data', onData);
          stdout.write('\n');
          resolve(password);
          break;
        case '\u0003': // Ctrl-C
          process.exit();
          break;
        case '\u007f': // Backspace
          if (password.length > 0) {
            password = password.slice(0, -1);
            stdout.clearLine();
            stdout.cursorTo(0);
            stdout.write(prompt + '*'.repeat(password.length));
          }
          break;
        default:
          password += char;
          stdout.write('*');
          break;
      }
    };

    stdin.on('data', onData);
  });
}

async function hashPassword(password) {
  return argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 65536,
    timeCost: 3,
  });
}

async function main() {
  console.log('');
  console.log('==================================================');
  console.log('ChefCloud Production User Creation');
  console.log('==================================================');
  console.log('');

  // Prompt for email
  const email = await question('Enter email: ');
  if (!email || !email.includes('@')) {
    console.error('ERROR: Invalid email address');
    process.exit(1);
  }

  // Prompt for password (hidden)
  const password = await questionHidden('Enter password: ');
  if (!password || password.length < 6) {
    console.error('\nERROR: Password must be at least 6 characters');
    process.exit(1);
  }

  // Prompt for role
  const roleLevelInput = await question('Enter role level (L1/L2/L3/L4/L5) [default: L5]: ');
  const roleLevel = roleLevelInput.toUpperCase() || 'L5';

  if (!['L1', 'L2', 'L3', 'L4', 'L5'].includes(roleLevel)) {
    console.error('ERROR: Invalid role level. Must be L1, L2, L3, L4, or L5');
    process.exit(1);
  }

  // Prompt for org slug
  const orgSlug = await question('Enter org slug [default: demo-restaurant]: ') || 'demo-restaurant';

  console.log('');
  console.log('---');
  console.log('Configuration:');
  console.log(`  Email:      ${email}`);
  console.log(`  Role:       ${roleLevel}`);
  console.log(`  Org Slug:   ${orgSlug}`);
  console.log('---');
  console.log('');

  const confirm = await question('Create this user? (yes/no): ');
  if (confirm.toLowerCase() !== 'yes' && confirm.toLowerCase() !== 'y') {
    console.log('Cancelled.');
    process.exit(0);
  }

  console.log('');
  console.log('Creating user...');

  try {
    // Find or create org
    let org = await prisma.org.findUnique({
      where: { slug: orgSlug },
    });

    if (!org) {
      console.log(`Org "${orgSlug}" not found. Creating new org...`);
      org = await prisma.org.create({
        data: {
          name: orgSlug
            .split('-')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '),
          slug: orgSlug,
        },
      });
      console.log(`✅ Created org: ${org.name}`);

      // Create default org settings
      await prisma.orgSettings.create({
        data: {
          orgId: org.id,
          vatPercent: 18.0,
          currency: 'UGX',
        },
      });
      console.log('✅ Created default org settings');
    }

    // Find first branch (or create one)
    let branch = await prisma.branch.findFirst({
      where: { orgId: org.id },
    });

    if (!branch) {
      console.log('No branches found. Creating default branch...');
      branch = await prisma.branch.create({
        data: {
          orgId: org.id,
          name: 'Main Branch',
          address: 'Kampala, Uganda',
          timezone: 'Africa/Kampala',
        },
      });
      console.log(`✅ Created branch: ${branch.name}`);
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Upsert user
    const user = await prisma.user.upsert({
      where: { email },
      update: {
        passwordHash,
        roleLevel,
        isActive: true,
      },
      create: {
        email,
        passwordHash,
        firstName: email.split('@')[0],
        lastName: 'Demo',
        roleLevel,
        orgId: org.id,
        branchId: branch.id,
        isActive: true,
      },
    });

    console.log('');
    console.log('==================================================');
    console.log('✅ SUCCESS');
    console.log('==================================================');
    console.log(`Email:    ${user.email}`);
    console.log(`Role:     ${user.roleLevel}`);
    console.log(`Org:      ${org.name} (${org.slug})`);
    console.log(`Branch:   ${branch.name}`);
    console.log(`Active:   ${user.isActive}`);
    console.log('==================================================');
    console.log('');
    console.log('You can now use these credentials to login.');
    console.log('');

  } catch (error) {
    console.error('');
    console.error('ERROR creating user:');
    console.error(error.message);
    if (error.code === 'P2002') {
      console.error('');
      console.error('This email already exists. User was not updated.');
      console.error('To update password, manually delete the user first.');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
