#!/usr/bin/env node
/**
 * Query FiscalInvoice records from the database
 * Usage: node scripts/query-fiscal-invoices.js
 */

const { PrismaClient } = require('@chefcloud/db');

async function main() {
  const prisma = new PrismaClient();

  try {
    const invoices = await prisma.fiscalInvoice.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    console.log('\n=== Recent Fiscal Invoices ===\n');

    if (invoices.length === 0) {
      console.log('No fiscal invoices found.');
    } else {
      invoices.forEach((inv) => {
        console.log(`ID: ${inv.id}`);
        console.log(`Order ID: ${inv.orderId}`);
        console.log(`Status: ${inv.status}`);
        console.log(`TIN: ${inv.efirsTin || 'N/A'}`);
        console.log(`Device: ${inv.deviceCode || 'N/A'}`);
        console.log(`Attempts: ${inv.attempts}`);
        console.log(`Response: ${JSON.stringify(inv.response, null, 2)}`);
        console.log(`Created: ${inv.createdAt}`);
        console.log('---');
      });
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
