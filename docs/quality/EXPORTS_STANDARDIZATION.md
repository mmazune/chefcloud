# CSV Export Standardization

> Phase H4 Quality Hardening Documentation
> Last Updated: 2024

## Overview

All CSV exports in NimbusCloud follow a standardized pattern to ensure:
1. **Determinism** - Same data produces identical output
2. **Integrity** - SHA-256 hash enables tamper detection
3. **Excel Safety** - BOM and formula injection prevention
4. **Auditability** - Consistent headers for compliance

## Export Contract

Every CSV export endpoint MUST implement these requirements:

### 1. UTF-8 BOM (Byte Order Mark)

```typescript
const BOM = '\uFEFF';
const content = BOM + csvRows.join('\n');
```

**Why?** Excel on Windows requires BOM to properly detect UTF-8 encoding. Without it, non-ASCII characters (accented names, currency symbols) appear corrupted.

### 2. Content-Type Header

```typescript
res.setHeader('Content-Type', 'text/csv; charset=utf-8');
```

### 3. Content-Disposition Header

```typescript
const date = new Date().toISOString().split('T')[0];
res.setHeader('Content-Disposition', `attachment; filename="${prefix}-${date}.csv"`);
```

### 4. SHA-256 Hash Header

```typescript
import { createHash } from 'crypto';

function computeHash(content: string): string {
  const normalized = content.replace(/\r\n/g, '\n'); // LF normalization
  return createHash('sha256').update(normalized, 'utf8').digest('hex');
}

res.setHeader('X-Nimbus-Export-Hash', computeHash(csvContent));
```

**Why?** Hash enables clients to verify export integrity and detect modifications.

### 5. CSV Injection Prevention

```typescript
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  
  // Prevent formula injection - prefix with single quote
  const injectionChars = ['=', '+', '-', '@', '\t', '\r', '\n'];
  if (injectionChars.some(c => str.startsWith(c))) {
    return `"'${str.replace(/"/g, '""')}"`;
  }
  
  // Standard CSV escaping
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}
```

### 6. Stable Ordering

All queries MUST include deterministic ordering:

```typescript
const items = await this.prisma.menuItem.findMany({
  where: { orgId },
  orderBy: [
    { sortOrder: 'asc' },
    { id: 'asc' }, // Tiebreaker for determinism
  ],
});
```

## Reference Implementation

The canonical implementation is in [menu.service.ts](../services/api/src/menu/menu.service.ts):

```typescript
async exportItemsCsv(orgId: string, branchId?: string): Promise<{ content: string; hash: string }> {
  const items = await this.prisma.menuItem.findMany({
    where: { orgId, branchId: branchId || undefined },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
    include: { category: true },
  });

  const BOM = '\uFEFF';
  const header = 'ID,SKU,Name,Category,Price,Status,Sort Order';
  const rows = items.map(item => 
    [
      this.escapeCSV(item.id),
      this.escapeCSV(item.sku),
      this.escapeCSV(item.name),
      this.escapeCSV(item.category?.name),
      item.price.toString(),
      this.escapeCSV(item.status),
      item.sortOrder?.toString() || '',
    ].join(',')
  );

  const content = BOM + [header, ...rows].join('\n');
  const hash = this.computeHash(content);

  return { content, hash };
}
```

## Endpoint Compliance Matrix

| Module | Endpoint | BOM | Hash | Escape | Stable Order |
|--------|----------|-----|------|--------|--------------|
| Menu | GET /menu/export/items.csv | ✅ | ✅ | ✅ | ✅ |
| Menu | GET /menu/export/modifiers.csv | ✅ | ✅ | ✅ | ✅ |
| Payroll | GET /workforce/payroll-runs/:id/export | ⚠️ | ⚠️ | ✅ | ✅ |
| Payroll | GET /workforce/payroll-runs/reports/export/* | ⚠️ | ⚠️ | ✅ | ✅ |
| Inventory | GET /inventory/valuation/export | ✅ | ✅ | ✅ | ✅ |
| Inventory | GET /inventory/cogs/export | ✅ | ✅ | ✅ | ✅ |
| Inventory | GET /inventory/waste/export | ✅ | ✅ | ✅ | ✅ |
| Inventory | GET /inventory/transfers/export | ✅ | ✅ | ✅ | ✅ |
| Compliance | GET /workforce/compliance/export/incidents | ✅ | ✅ | ✅ | ✅ |
| Compliance | GET /workforce/compliance/export/penalties | ✅ | ✅ | ✅ | ✅ |
| Geofence | GET /workforce/geofence/events/export | ✅ | ✅ | ✅ | ✅ |
| Kiosk | GET /workforce/kiosk/:id/events/export | ✅ | ✅ | ✅ | ✅ |
| Close Requests | GET /inventory/periods/close-requests/export | ✅ | ✅ | ✅ | ✅ |
| Notifications | GET /inventory/notifications/export | ✅ | ✅ | ✅ | ✅ |
| Webhooks | GET /integrations/webhooks/export | ✅ | ✅ | ✅ | ✅ |
| Leave | GET /workforce/leave/reports/export/* | ✅ | ✅ | ✅ | ✅ |
| Planning | GET /workforce/planning/export/* | ✅ | ✅ | ✅ | ✅ |
| POS | GET /pos/payments/export/*.csv | ✅ | ✅ | ✅ | ✅ |

**Legend:**
- ✅ Fully compliant
- ⚠️ Partially compliant (needs upgrade)
- ❌ Non-compliant

## E2E Test Coverage

The export contract is verified in [h4-quality-hardening.e2e-spec.ts](../services/api/test/h4-quality-hardening.e2e-spec.ts):

```typescript
describe('A: CSV Export Contract', () => {
  it('should return CSV with BOM, Content-Type, hash header, and Excel-safe content');
  it('should produce deterministic hash for same data');
});
```

## Upgrade Checklist

When adding a new CSV export:

- [ ] Add UTF-8 BOM at start of content
- [ ] Set `Content-Type: text/csv; charset=utf-8`
- [ ] Set `Content-Disposition: attachment; filename="..."` 
- [ ] Compute SHA-256 hash of LF-normalized content
- [ ] Set `X-Nimbus-Export-Hash` header
- [ ] Use `escapeCSV()` for all string values
- [ ] Include stable `orderBy` with `id` tiebreaker
- [ ] Add to compliance matrix in this document
- [ ] Add E2E test if critical endpoint
