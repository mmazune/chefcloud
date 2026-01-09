# M30-OPS-S6 Completion Report
**Diagnostics: Billing & Plan Status Integration**

## Overview
Successfully integrated billing and plan status into the diagnostics system. Support/ops teams can now see subscription status, plan ID, and risk state directly in the System Diagnostics panel and JSON exports, streamlining troubleshooting workflows.

## Implementation Summary

### 1. Extended DiagnosticsSnapshot with Billing Section
**File**: `apps/web/src/lib/diagnostics.ts`

Added new interfaces and fields:
- **BillingSnapshot interface**: Contains status, planId, and isRiskState
- **Import**: Added `BillingSubscriptionStatus` from `@/types/billing`
- **DiagnosticsSnapshot field**: Added `billing: BillingSnapshot | null`

```typescript
export interface BillingSnapshot {
  status: BillingSubscriptionStatus | null;
  planId: string | null;
  isRiskState: boolean;
}

export interface DiagnosticsSnapshot {
  // ... existing fields
  billing: BillingSnapshot | null;
}
```

### 2. Wired Billing into SystemDiagnosticsPanel
**File**: `apps/web/src/components/common/SystemDiagnosticsPanel.tsx`

**Imports Added**:
- `usePlanCapabilities` hook
- `isSubscriptionInRiskState` helper

**Data Integration**:
- Called `usePlanCapabilities()` to get subscription data
- Built `billingSnapshot` inside snapshot creation useMemo:
  - `status`: From `subscription.status`
  - `planId`: From `subscription.planId`
  - `isRiskState`: Computed via `isSubscriptionInRiskState(subscription)`
- Set `billing: null` when subscription unavailable

**JSON Export**: Automatically includes billing info in Copy/Download JSON

### 3. Extended UI to Show Billing & Plan
**Location**: Environment section of SystemDiagnosticsPanel

Added new "Billing & plan" row after "Last error":
- **When subscription available**:
  - Shows status in monospaced font (e.g., "ACTIVE", "PAST_DUE")
  - Shows plan ID in gray text (e.g., "(plan: FRANCHISE_CORE)")
  - Shows red "at risk" badge when `isSubscriptionInRiskState(subscription)` returns true
- **When subscription null**:
  - Shows "Not available (billing service unreachable or not loaded)"

### 4. Updated Diagnostics Tests
**File**: `apps/web/src/lib/diagnostics.test.ts`

Added 2 new tests:
1. **Billing data in JSON**: Verifies `serializeDiagnosticsSnapshot` includes billing fields
2. **Null billing handling**: Ensures null billing is properly serialized

Sample test snapshot with billing:
```json
{
  "billing": {
    "status": "PAST_DUE",
    "planId": "FRANCHISE_CORE",
    "isRiskState": true
  }
}
```

### 5. Updated SystemDiagnosticsPanel Tests
**File**: `apps/web/src/components/common/SystemDiagnosticsPanel.test.tsx`

Added mock for `usePlanCapabilities` with hoist-safe pattern (following E24-BILLING-FE-S3).

Added 4 new tests:
1. **Subscription null**: Shows "Not available" message
2. **ACTIVE subscription**: Shows status and plan, no "at risk" badge
3. **PAST_DUE subscription**: Shows status, plan, and "at risk" badge
4. **EXPIRED subscription**: Shows status, plan, and "at risk" badge
5. **CANCELED subscription**: Shows status, plan, and "at risk" badge

## Files Modified (5)

### 1. `apps/web/src/lib/diagnostics.ts`
**Changes**:
- Added import for `BillingSubscriptionStatus`
- Added `BillingSnapshot` interface (3 fields)
- Added `billing: BillingSnapshot | null` to `DiagnosticsSnapshot`

**Lines**: ~10 lines added

### 2. `apps/web/src/components/common/SystemDiagnosticsPanel.tsx`
**Changes**:
- Imported `usePlanCapabilities` and `isSubscriptionInRiskState`
- Called `usePlanCapabilities()` hook
- Computed `billingSnapshot` in useMemo with status, planId, isRiskState
- Added billing to snapshot object
- Added "Billing & plan" row in Environment section with:
  - Status display
  - Plan ID display
  - "at risk" badge for PAST_DUE/EXPIRED/CANCELED
  - Fallback message when subscription null

**Lines**: ~50 lines added/modified

### 3. `apps/web/src/lib/diagnostics.test.ts`
**Changes**:
- Updated existing test to include billing field
- Added new test for null billing handling
- Added assertions for billing fields in JSON output

**Lines**: ~50 lines added

### 4. `apps/web/src/components/common/SystemDiagnosticsPanel.test.tsx`
**Changes**:
- Added hoist-safe mock for `usePlanCapabilities`
- Added mock for `useLastErrorRecord` (was missing)
- Added beforeEach to set default subscription mock (null)
- Added 4 new billing integration tests

**Lines**: ~100 lines added

## Test Results

### Focused Diagnostics Tests
```
Test Suites: 2 passed, 2 total
Tests:       11 passed, 11 total
```

**Breakdown**:
- `diagnostics.test.ts`: 5 tests (3 existing + 2 new)
- `SystemDiagnosticsPanel.test.tsx`: 6 tests (2 existing + 4 new)

### Full Test Suite
```
Test Suites: 67 passed, 67 total
Tests:       567 passed, 567 total
Time:        46.477 s
```

**New test count**: 567 (561 from E24-BILLING-FE-S5 + 6 new)

### Lint Results
✅ **PASS** - No new errors, only pre-existing warnings

### Build Results
✅ **PASS** - Next.js production build successful
- KDS page: 18.2 kB → 138 kB first load (slight increase from billing integration)
- POS page: 13.8 kB → 151 kB first load (slight increase)

## Key Design Decisions

### 1. Non-Intrusive Data Layer
- Billing field added to existing DiagnosticsSnapshot structure
- No breaking changes to existing snapshot fields
- Gracefully handles null subscription (network issues, service unavailable)

### 2. Read-Only Ops/Support Context
- No CTAs or action buttons in diagnostics panel
- Pure informational display for support/engineering teams
- Complements existing billing banners (E24-BILLING-FE-S3/S4/S5)

### 3. Risk State Computation
- Leverages `isSubscriptionInRiskState()` from E24-BILLING-FE-S5
- Consistent definition: PAST_DUE, EXPIRED, CANCELED
- Visual "at risk" badge for quick identification

### 4. JSON Export Inclusion
- Billing data automatically included in JSON snapshots
- No special serialization logic needed
- Support teams can review billing context offline

### 5. Minimal UI Footprint
- Single row added to Environment section
- Compact display with inline plan ID
- Small red badge for risk states (matches E24-BILLING-FE-S5 tone)

## Integration with Existing Features

### E24-BILLING-FE-S3 (Modal Gates)
- SystemDiagnosticsPanel can be accessed even when gated
- Allows support to see billing context during troubleshooting

### E24-BILLING-FE-S4 (Status Banner)
- Diagnostics shows raw status (e.g., "PAST_DUE")
- Status banner shows user-friendly messaging
- Both use same subscription source

### E24-BILLING-FE-S5 (Inline Risk Banners)
- Diagnostics uses same `isSubscriptionInRiskState()` helper
- Risk state definition consistent across features
- Diagnostics provides ops/support view, banners provide user-facing warnings

### M30-OPS-S1/S2/S3 (Diagnostics Foundation)
- Billing seamlessly integrated into existing snapshot model
- Follows same pattern as other nested blocks (cache, queue, environment)
- JSON serialization works out of the box

## No Regressions

### Verified Areas:
- ✅ All 561 existing tests pass
- ✅ POS functionality unchanged
- ✅ KDS functionality unchanged
- ✅ Offline queue reporting unchanged
- ✅ Cache & storage metrics unchanged
- ✅ Last error display unchanged
- ✅ JSON export/download buttons work
- ✅ Existing diagnostics snapshot fields intact

## User Experience Impact

### For Support Teams:
1. **Single Source of Truth**: All diagnostic context including billing in one panel
2. **Quick Risk Assessment**: Red "at risk" badge immediately flags billing issues
3. **Offline Troubleshooting**: JSON exports include billing state for later review
4. **Plan Context**: See which plan customer is on (FRANCHISE_CORE, MICROS_PRO, etc.)

### For Engineers:
1. **Structured Data**: BillingSnapshot type ensures consistent billing info
2. **Testable**: Full test coverage for all subscription states
3. **Extensible**: Easy to add more billing fields in future (e.g., grace period, next bill date)

## Example Output

### Panel Display (PAST_DUE):
```
Environment
  User agent: Mozilla/5.0...
  Platform: MacIntel
  Service worker: Supported
  Last error: None
  Billing & plan: PAST_DUE (plan: FRANCHISE_CORE) [at risk]
```

### Panel Display (ACTIVE):
```
Environment
  ...
  Billing & plan: ACTIVE (plan: MICROS_PRO)
```

### Panel Display (Null):
```
Environment
  ...
  Billing & plan: Not available (billing service unreachable or not loaded)
```

### JSON Export Sample:
```json
{
  "appVersion": "1.47.2",
  "context": "POS",
  "deviceRole": "POS",
  "online": true,
  ...
  "billing": {
    "status": "PAST_DUE",
    "planId": "FRANCHISE_CORE",
    "isRiskState": true
  }
}
```

## Commits Ready

### Commit 1: Extend diagnostics model with billing
```
feat(ops): add billing & plan status to diagnostics snapshot

- Add BillingSnapshot interface to diagnostics.ts
- Add billing field to DiagnosticsSnapshot (status, planId, isRiskState)
- Import BillingSubscriptionStatus type
- Gracefully handle null subscription state

M30-OPS-S6
```

### Commit 2: Wire billing into SystemDiagnosticsPanel
```
feat(ops): integrate billing status into diagnostics panel UI

- Call usePlanCapabilities hook to get subscription data
- Compute billingSnapshot with status, planId, isRiskState
- Add billing to snapshot object for JSON export
- Add "Billing & plan" row in Environment section
- Show status, plan ID, and "at risk" badge for risky subscriptions
- Show fallback message when subscription unavailable

M30-OPS-S6
```

### Commit 3: Add diagnostics billing tests
```
test(ops): add comprehensive tests for billing in diagnostics

- Add 2 tests for serializeDiagnosticsSnapshot with billing
- Add 4 tests for SystemDiagnosticsPanel billing UI
- Test null subscription handling
- Test ACTIVE, PAST_DUE, EXPIRED, CANCELED states
- Verify "at risk" badge for risky states
- All 567 tests passing (561 existing + 6 new)

M30-OPS-S6
```

## Next Steps (Future Work)

### Potential Enhancements:
1. **Grace Period Display**: Show days remaining until service cutoff for PAST_DUE
2. **Next Bill Date**: Add upcoming billing date to snapshot
3. **Billing History Link**: Deep link to billing history in diagnostics panel
4. **API Usage Metrics**: Show current month's API call count vs plan limits
5. **Subscription Age**: Show how long customer has been subscribed

### Related Work:
- M30-OPS-S1/S2/S3: Diagnostics foundation ✅ Complete
- E24-BILLING-FE-S3/S4/S5: Billing UI & status helpers ✅ Complete
- M30-OPS-S6: Billing diagnostics integration ✅ Complete (this ticket)

## Summary
M30-OPS-S6 successfully integrates billing and plan status into the diagnostics system:
- DiagnosticsSnapshot now includes billing field (status, planId, isRiskState)
- SystemDiagnosticsPanel shows "Billing & plan" row with:
  - Status and plan ID when available
  - Red "at risk" badge for PAST_DUE/EXPIRED/CANCELED
  - Clear fallback message when subscription unavailable
- JSON exports automatically include billing context
- All 567 tests pass (561 existing + 6 new)
- Lint and build successful

Ready for production deployment.

---

**Implementation Date**: 2025-12-03  
**Test Results**: 567/567 passing  
**Build Status**: ✅ Successful  
**Lint Status**: ✅ No new errors
