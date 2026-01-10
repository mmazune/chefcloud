# Audit Trail Spot Check

> Phase H4 Quality Hardening Documentation
> Last Updated: 2024

## Overview

This document catalogs critical write operations and their audit trail evidence. Each entry confirms that sensitive operations leave a traceable record for compliance and forensic analysis.

## Audit Trail Categories

### 1. General Ledger (GL) Entries

Financial postings create immutable journal entries with balanced debits/credits.

| Operation | Source Type | Evidence Table | Tested |
|-----------|-------------|----------------|--------|
| Payroll Posting | `PAYROLL_POST` | `JournalEntry` + `JournalEntryLine` | ✅ |
| Payroll Pay | `PAYROLL_PAY` | `JournalEntry` + `JournalEntryLine` | ⚠️ |
| Payroll Void | `PAYROLL_VOID` | `JournalEntry` (reversal) | ⚠️ |
| Inventory Goods Receipt | `INV_GOODS_RECEIPT` | `JournalEntry` | ⚠️ |
| Inventory Waste | `INV_WASTE` | `JournalEntry` | ⚠️ |
| Inventory Stocktake | `INV_STOCKTAKE` | `JournalEntry` | ⚠️ |

### 2. Inventory Ledger Entries

Stock movements create ledger entries with quantity, cost, and reason.

| Operation | Source Type | Reason | Evidence Table | Tested |
|-----------|-------------|--------|----------------|--------|
| Goods Receipt | `GOODS_RECEIPT` | `RECEIPT` | `InventoryLedgerEntry` | ⚠️ |
| Waste Posting | `WASTE` | `WASTAGE` | `InventoryLedgerEntry` | ✅ |
| Transfer Out | `TRANSFER` | `TRANSFER_OUT` | `InventoryLedgerEntry` | ⚠️ |
| Transfer In | `TRANSFER` | `TRANSFER_IN` | `InventoryLedgerEntry` | ⚠️ |
| Stocktake Adjustment | `STOCKTAKE` | `ADJUSTMENT` | `InventoryLedgerEntry` | ⚠️ |
| Depletion | `DEPLETION` | `SALE` | `InventoryLedgerEntry` | ⚠️ |

### 3. Workforce Audit Log

Staff-related operations create audit log entries.

| Operation | Action | Evidence Table | Tested |
|-----------|--------|----------------|--------|
| Pay Period Close | `PAY_PERIOD_CLOSED` | `WorkforceAuditLog` | ⚠️ |
| Shift Update | `SHIFT_UPDATED` | `WorkforceAuditLog` | ⚠️ |
| Time Entry Approval | `TIME_ENTRY_APPROVED` | `WorkforceAuditLog` | ⚠️ |

### 4. Period Close Events

Inventory period lifecycle creates event records.

| Event | Evidence Table | Tested |
|-------|----------------|--------|
| Period Created | `InventoryPeriodEvent` | ⚠️ |
| Close Request Created | `InventoryPeriodCloseRequest` | ⚠️ |
| Close Request Submitted | `InventoryPeriodEvent` | ⚠️ |
| Close Request Approved | `InventoryPeriodEvent` | ⚠️ |
| Close Request Rejected | `InventoryPeriodEvent` | ⚠️ |
| Period Closed | `InventoryPeriodEvent` | ⚠️ |

**Legend:**
- ✅ Verified by E2E test
- ⚠️ Implemented but not yet tested

## Evidence Verification Queries

### Payroll GL Entries

```sql
SELECT 
  pr.run_number,
  je.reference,
  je.source,
  je.amount,
  je.created_at,
  COUNT(jel.id) as line_count
FROM payroll_runs pr
JOIN payroll_gl_entry_links pgel ON pgel.run_id = pr.id
JOIN journal_entries je ON je.id = pgel.journal_entry_id
JOIN journal_entry_lines jel ON jel.journal_entry_id = je.id
WHERE pr.org_id = :orgId
GROUP BY pr.id, je.id
ORDER BY je.created_at DESC;
```

### Inventory Waste Ledger Entries

```sql
SELECT 
  iw.waste_number,
  ile.source_type,
  ile.reason,
  ile.quantity,
  ile.created_at
FROM inventory_wastes iw
JOIN inventory_ledger_entries ile ON ile.source_id = iw.id
WHERE iw.org_id = :orgId
  AND iw.status = 'POSTED'
ORDER BY ile.created_at DESC;
```

## E2E Test Coverage

Tests are in [h4-quality-hardening.e2e-spec.ts](../services/api/test/h4-quality-hardening.e2e-spec.ts):

```typescript
describe('C: Audit Trail Verification', () => {
  describe('C1: Payroll posting creates journal entry');
  describe('C2: Inventory waste creates ledger entries');
});
```

### C1: Payroll Posting Audit Trail

```typescript
it('should verify posted payroll runs have linked journal entries', async () => {
  const postedRuns = await prisma.payrollRun.findMany({
    where: { orgId, status: { in: ['POSTED', 'PAID'] } },
    include: { glEntryLinks: { include: { journalEntry: true } } },
  });

  for (const run of postedRuns) {
    expect(run.glEntryLinks.length).toBeGreaterThan(0);
    for (const link of run.glEntryLinks) {
      expect(link.journalEntry.source).toMatch(/PAYROLL/);
    }
  }
});
```

### C2: Inventory Waste Audit Trail

```typescript
it('should verify posted waste documents have ledger entries', async () => {
  const ledgerEntries = await prisma.inventoryLedgerEntry.findMany({
    where: { orgId, sourceId: waste.id, sourceType: 'WASTE' },
  });

  expect(ledgerEntries.length).toBeGreaterThan(0);
  for (const entry of ledgerEntries) {
    expect(entry.quantity.toNumber()).toBeLessThanOrEqual(0);
    expect(entry.reason).toBe('WASTAGE');
  }
});
```

## Implementation Patterns

### GL Entry Creation (Payroll)

```typescript
// payroll-posting.service.ts
const journalEntry = await tx.journalEntry.create({
  data: {
    orgId,
    branchId,
    entryDate: new Date(),
    reference: `PAYROLL-${run.runNumber}`,
    source: 'PAYROLL_POST',
    description: `Payroll posting for run ${run.runNumber}`,
    amount: totalDebits,
    createdBy: userId,
    lines: { create: journalLines },
  },
});

await tx.payrollGlEntryLink.create({
  data: {
    runId: run.id,
    journalEntryId: journalEntry.id,
    linkType: 'POST',
  },
});
```

### Ledger Entry Creation (Waste)

```typescript
// inventory-waste.service.ts
await this.ledgerService.createEntry({
  orgId,
  branchId,
  itemId: line.itemId,
  locationId: waste.locationId,
  sourceType: LedgerSourceType.WASTE,
  sourceId: waste.id,
  quantity: -line.quantity, // Negative for removal
  reason: LedgerEntryReason.WASTAGE,
  createdBy: userId,
});
```

## Compliance Requirements

### SOX Compliance (Financial)

- All GL postings must have:
  - User ID of poster (`createdBy`)
  - Timestamp (`createdAt`)
  - Source reference (`source`, `reference`)
  - Original document link (`sourceId`)

### Inventory Control

- All stock movements must have:
  - Quantity and unit
  - Reason code
  - Source document reference
  - Location/branch

## Adding New Audit Points

When adding new auditable operations:

1. Identify the audit category (GL, Ledger, Workforce, Period)
2. Create appropriate evidence record in transaction
3. Include required fields (userId, timestamp, source, reference)
4. Add entry to this matrix
5. Add E2E verification test if critical
6. Document in relevant module documentation
