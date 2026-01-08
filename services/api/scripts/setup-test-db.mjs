#!/usr/bin/env node
/**
 * Cross-platform E2E Test Database Setup
 * - Loads .env.e2e
 * - Runs Prisma migrate reset against test DB
 * - Seeds demo data
 * - Verifies seed integrity
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const apiRoot = path.resolve(__dirname, '..');

function log(msg) {
  console.log(msg);
}

function maskDbUrl(url) {
  try {
    return String(url).replace(/:\/\/[^:]*:[^@]*@/, '://***:***@');
  } catch {
    return url;
  }
}

function loadEnvE2E() {
  const envPath = path.join(apiRoot, '.env.e2e');
  if (!fs.existsSync(envPath)) {
    throw new Error('.env.e2e not found. Create services/api/.env.e2e with DATABASE_URL');
  }
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    // Strip surrounding quotes if present
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (key) process.env[key] = val;
  }
}

function getDbName(dbUrl) {
  try {
    const noQuery = dbUrl.split('?')[0];
    return noQuery.substring(noQuery.lastIndexOf('/') + 1);
  } catch {
    return '';
  }
}

function execFile(bin, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(bin, args, {
      cwd: apiRoot,
      stdio: 'inherit',
      shell: process.platform === 'win32',
      env: { ...process.env },
      ...options,
    });
    child.on('error', reject);
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${bin} exited with code ${code}`));
    });
  });
}

async function main() {
  log('🔧 E2E Test Database Setup');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  loadEnvE2E();
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) throw new Error('DATABASE_URL not set in .env.e2e');
  log(`📍 Target: ${maskDbUrl(dbUrl)}`);
  const dbName = getDbName(dbUrl);
  log(`🗄️  Database: ${dbName}`);
  if (!/test/i.test(dbName)) {
    throw new Error(`SAFETY CHECK FAILED: Database name must include 'test' (got '${dbName}')`);
  }

  const schemaPath = path.resolve(apiRoot, '../../packages/db/prisma/schema.prisma');
  if (!fs.existsSync(schemaPath)) throw new Error(`Prisma schema not found: ${schemaPath}`);

  const prismaBin = path.resolve(apiRoot, '../../node_modules/.pnpm/node_modules/.bin/prisma');
  if (!fs.existsSync(prismaBin)) throw new Error('Prisma CLI not found. Run pnpm install.');

  log('');
  log('🔄 Resetting test database (FK-proof clean slate)...');
  // For cross-platform test setup, prefer schema sync over migrations
  await execFile(prismaBin, [
    'db',
    'push',
    '--force-reset',
    '--skip-generate',
    `--schema=${schemaPath}`,
  ]);
  log('');
  log('✅ Database reset complete - schema is clean');

  log('');
  log('🌱 Seeding E2E test data...');
  const seedScript = path.resolve(apiRoot, 'prisma/seed.ts');
  if (!fs.existsSync(seedScript)) throw new Error(`Seed script not found: ${seedScript}`);

  // Use npx tsx to run the seed TypeScript file
  await execFile('npx', ['tsx', seedScript]);
  log('');
  log('✅ Seed complete - demo users ready');

  const verifyScript = path.resolve(apiRoot, 'scripts/verify-e2e-seed.mjs');
  if (fs.existsSync(verifyScript)) {
    log('');
    log('🔍 Verifying seed data integrity...');
    await execFile('node', [verifyScript, process.env.E2E_DATASET || 'DEMO_TAPAS']);
    log('✅ Seed verification passed');
  } else {
    log('⚠️  Warning: Verification script not found, skipping');
  }

  log('');
  log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  log('✅ Test database ready for E2E tests');
}

main().catch((err) => {
  console.error(`❌ Setup failed: ${err.message}`);
  process.exit(1);
});
