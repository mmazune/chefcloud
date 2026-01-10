# RBAC Negative Tests Matrix

> Phase H4 Quality Hardening Documentation
> Last Updated: 2024

## Overview

This document catalogs the RBAC (Role-Based Access Control) denial matrix for critical operations. Each entry proves that lower-privilege roles are correctly denied access to sensitive endpoints.

## Role Hierarchy

| Level | Name | Description |
|-------|------|-------------|
| L5 | Owner | Full access, financial operations, GL posting |
| L4 | Manager/Accountant | Admin operations, approvals, configuration |
| L3 | Supervisor | Operational oversight, procurement |
| L2 | Cashier/Chef | Front-line operations, POS |
| L1 | Waiter/Server | Basic ordering, clock in/out |

## Critical Operations Denial Matrix

### Financial Operations (L5 Required)

| Operation | Endpoint | Allowed | Denied | Tested |
|-----------|----------|---------|--------|--------|
| Post Payroll | `POST /workforce/payroll-runs/:id/post` | L5 | L4, L3, L2, L1 | ✅ |
| Void Payroll | `POST /workforce/payroll-runs/:id/void` | L5 | L4, L3, L2, L1 | ✅ |
| Pay Payroll | `POST /workforce/payroll-runs/:id/pay` | L5 | L4, L3, L2, L1 | ⚠️ |
| Approve Close Request | `POST /inventory/periods/close-requests/:id/approve` | L5 | L4, L3, L2, L1 | ✅ |
| Reject Close Request | `POST /inventory/periods/close-requests/:id/reject` | L5 | L4, L3, L2, L1 | ⚠️ |

### Configuration Operations (L4 Required)

| Operation | Endpoint | Allowed | Denied | Tested |
|-----------|----------|---------|--------|--------|
| Create GL Mapping | `POST /inventory/gl/mappings` | L4, L5 | L3, L2, L1 | ✅ |
| Update GL Mapping | `PUT /inventory/gl/mappings/:id` | L4, L5 | L3, L2, L1 | ⚠️ |
| Delete GL Mapping | `DELETE /inventory/gl/mappings/:id` | L4, L5 | L3, L2, L1 | ⚠️ |
| Create Payroll Run | `POST /workforce/payroll-runs` | L4, L5 | L3, L2, L1 | ✅ |
| Calculate Payroll | `POST /workforce/payroll-runs/:id/calculate` | L4, L5 | L3, L2, L1 | ⚠️ |
| Approve Payroll | `POST /workforce/payroll-runs/:id/approve` | L4, L5 | L3, L2, L1 | ⚠️ |
| Create Close Request | `POST /inventory/periods/:id/close-requests` | L4, L5 | L3, L2, L1 | ⚠️ |
| Export CSV (most) | `GET /*/export/*.csv` | L4, L5 | L3, L2, L1 | ✅ |

### Operational Access (L3 Required)

| Operation | Endpoint | Allowed | Denied | Tested |
|-----------|----------|---------|--------|--------|
| View GL Mappings | `GET /inventory/gl/mappings` | L3, L4, L5 | L2, L1 | ⚠️ |
| View GL Postings | `GET /inventory/gl/postings` | L3, L4, L5 | L2, L1 | ⚠️ |
| Preview GL Posting | `GET /inventory/gl/preview` | L3, L4, L5 | L2, L1 | ⚠️ |

**Legend:**
- ✅ Covered by E2E test
- ⚠️ Enforced but not yet tested

## E2E Test Coverage

Tests are in [h4-quality-hardening.e2e-spec.ts](../services/api/test/h4-quality-hardening.e2e-spec.ts):

```typescript
describe('B: RBAC Negative Tests', () => {
  describe('B1: Cashier (L2) cannot post payroll (L5 required)');
  describe('B2: Waiter (L1) cannot create inventory GL mappings (L4 required)');
  describe('B3: Manager (L4) cannot approve close request (L5 required)');
  describe('B4: Cashier (L2) cannot void payroll (L5 required)');
});
```

## Implementation Patterns

### Using @Roles Decorator

```typescript
// L5 only
@Post(':id/post')
@Roles('L5')
async postPayrollRun() { ... }

// L4 or L5
@Post(':id/calculate')
@Roles('L4', 'L5')
async calculatePayrollRun() { ... }
```

### Using roleLevel Check

```typescript
@Get('mappings')
async listMappings(@Req() req: any) {
  const { roleLevel } = req.user;
  if (roleLevel < 3) {
    throw new ForbiddenException('Manager role or higher required');
  }
  // ...
}
```

## Audit Findings

### Correctly Implemented

1. **Payroll Posting (L5)** - `@Roles('L5')` decorator on `postPayrollRun`
2. **Payroll Voiding (L5)** - `@Roles('L5')` decorator on `voidPayrollRun`  
3. **GL Mapping Mutations (L4)** - `roleLevel < 4` check with ForbiddenException
4. **Close Request Approval (L5)** - `@Roles('L5')` decorator

### Areas for Enhancement

1. Consider adding RBAC negative tests for:
   - Leave request delegation (OWNER/MANAGER)
   - Stocktake approval workflow
   - Vendor management permissions

## Adding New RBAC Tests

When adding new protected endpoints:

1. Identify the minimum role level required
2. Add `@Roles()` decorator or `roleLevel` check
3. Add entry to this matrix
4. Add E2E negative test in `h4-quality-hardening.e2e-spec.ts`
5. Document the business reason for the restriction

## Test Results Summary

```
Describe: B: RBAC Negative Tests
  ✓ B1: Cashier cannot post payroll → 403
  ✓ B2: Waiter cannot create GL mapping → 403
  ✓ B3: Manager cannot approve close request → 403
  ✓ B4: Cashier cannot void payroll → 403
```
