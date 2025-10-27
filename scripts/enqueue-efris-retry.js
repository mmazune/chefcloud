#!/usr/bin/env node
/**
 * Enqueue EFRIS retry job for a specific order
 * Usage: node scripts/enqueue-efris-retry.js <orderId>
 */

const { Queue } = require('bullmq');
const Redis = require('ioredis');

const orderId = process.argv[2];

if (!orderId) {
  console.error('Usage: node scripts/enqueue-efris-retry.js <orderId>');
  process.exit(1);
}

async function main() {
  const connection = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    maxRetriesPerRequest: null,
  });

  const efrisQueue = new Queue('efris', { connection });

  console.log(`Enqueuing EFRIS retry job for order: ${orderId}`);

  const job = await efrisQueue.add('efris-push', {
    type: 'efris-push',
    orderId,
  });

  console.log(`✅ Job enqueued successfully!`);
  console.log(`   Job ID: ${job.id}`);
  console.log(`   Order ID: ${orderId}`);
  console.log(`\nMonitor progress:`);
  console.log(`   - Check worker logs`);
  console.log(`   - Query: psql $DATABASE_URL -c "SELECT * FROM fiscal_invoices WHERE orderId='${orderId}'"`);

  await connection.quit();
  process.exit(0);
}

main().catch((error) => {
  console.error('Error:', error.message);
  process.exit(1);
});
