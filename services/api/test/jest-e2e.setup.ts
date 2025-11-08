import 'reflect-metadata';
import 'source-map-support/register';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.e2e before anything else
dotenv.config({ path: resolve(__dirname, '../.env.e2e') });

async function setup() {
  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    console.error('❌ DATABASE_URL not set. Create services/api/.env.e2e or set environment variable.');
    process.exit(1);
  }

  console.log('✓ E2E environment loaded');
  console.log('  DATABASE_URL:', dbUrl.replace(/:[^:@]+@/, ':***@'));
}

export default setup;
