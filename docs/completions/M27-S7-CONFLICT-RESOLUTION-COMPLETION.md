# M27-S7: POS Offline Conflict Detection – COMPLETION

**Session Goal:** Detect dangerous conflicts when replaying offline actions.

**Status:** ✅ **COMPLETE** – Conflict detection implemented with read-before-write checks.

---

## Implementation Summary

Successfully implemented conflict detection for the POS offline queue system. When syncing queued actions, the system now detects if an order has been closed/voided/cancelled on another device and skips those actions with clear conflict marking.

### Core Conflict Detection Strategy

**Read-Before-Write Pattern:**
- Before replaying risky actions (payOrder, voidOrder, updateItems, addItems, sendToKitchen)
- Fetch current server order state via GET /api/pos/orders/:id
- Check if order is in final state: CLOSED, VOIDED, CANCELLED, PAID
- If conflict detected: skip action, mark as conflict, remove from queue
- If no conflict: proceed with normal sync

**Fail-Open Philosophy:**
- If conflict detection fails (network error, unexpected response), proceed with normal sync
- Idempotency (M21) protects against duplicates anyway
- Better to attempt sync than block all actions due to detection failure

### Changes Made

#### 1. Extended Types (`useOfflineQueue.ts`)

**SyncStatus Type:**
```typescript
type SyncStatus = 'pending' | 'syncing' | 'success' | 'failed' | 'conflict';
```

**SyncLogEntry Interface:**
```typescript
interface SyncLogEntry {
  id: string;
  label: string;
  createdAt: string;
  status: SyncStatus;
  lastAttemptAt?: string;
  errorMessage?: string;
  conflictDetails?: {           // M27-S7: New field
    reason: string;
    orderId?: string;
    serverStatus?: string;
  };
}
```

#### 2. Action Parsing Helper

**QueueActionKind Type:**
```typescript
type QueueActionKind =
  | 'createOrder'      // No orderId yet, always safe
  | 'addItems'         // Risky if order closed
  | 'updateItems'      // Risky if order closed
  | 'sendToKitchen'    // Risky if order closed
  | 'payOrder'         // Risky if order already paid
  | 'voidOrder'        // Risky if order already voided
  | 'other';           // Unknown actions, proceed with caution
```

**parseQueueAction() Function:**
- Parses request URL to extract action kind and order ID
- Uses regex to match POS endpoint patterns
- Returns `{ kind, orderId? }` for each queued request

**URL Patterns Detected:**
- `POST /api/pos/orders` → createOrder (no orderId)
- `POST /api/pos/orders/:id/items` → addItems
- `PATCH /api/pos/orders/:id/items` → updateItems
- `POST /api/pos/orders/:id/send` → sendToKitchen
- `POST /api/pos/orders/:id/pay` → payOrder
- `POST /api/pos/orders/:id/void` → voidOrder

#### 3. Conflict Detection Helper

**checkOrderConflict() Function:**
```typescript
async function checkOrderConflict(
  orderId: string,
  actionKind: QueueActionKind
): Promise<{ hasConflict: boolean; reason?: string; serverStatus?: string }>
```

**Logic:**
1. Only runs for risky actions: `['payOrder', 'voidOrder', 'updateItems', 'addItems', 'sendToKitchen']`
2. Fetches GET /api/pos/orders/:id to check current server state
3. Extracts status from response (handles multiple status field names)
4. Checks if status is final: `['CLOSED', 'VOIDED', 'CANCELLED', 'PAID']`
5. Returns conflict details if final state detected
6. Fails open on errors (returns `hasConflict: false`)

**Authorization:**
- Uses localStorage token: `Authorization: Bearer ${localStorage.getItem('token')}`
- Inherits same auth as normal POS requests

#### 4. syncQueue Integration

**Modified Sync Loop:**
```typescript
for (const item of currentQueue) {
  // M27-S7: Check for conflicts before attempting sync
  const { kind, orderId } = parseQueueAction(item);
  if (orderId) {
    const conflict = await checkOrderConflict(orderId, kind);
    if (conflict.hasConflict) {
      // Skip action, mark as conflict, remove from queue
      updateLogStatus(item.id, prev => ({
        // ... status: 'conflict', errorMessage, conflictDetails
      }));
      currentQueue = currentQueue.filter(q => q.id !== item.id);
      setQueue(currentQueue);
      saveQueue(currentQueue);
      continue;
    }
  }

  // Normal sync logic continues...
}
```

**Conflict Resolution:**
- Conflicted actions are permanently removed from queue (no retry)
- Different from failed actions which remain in queue for retry
- Conflict means business-level incompatibility, not technical error

#### 5. UI Updates

**PosSyncStatusPanel.tsx:**
- Added 'conflict' case to `statusBadgeColor()`: orange colors (`bg-orange-100 text-orange-800 border-orange-300`)
- Added `hasConflicts` flag: `sortedLog.some(e => e.status === 'conflict')`
- Display conflict badge in header: "⚠︎ Conflicts detected" (orange)
- Color conflict error messages orange instead of red

**pos/index.tsx:**
- Added `conflictCount`: `syncLog.filter(entry => entry.status === 'conflict').length`
- Updated offline banner: show conflict count badge (orange)
- Added online conflict banner: "Some offline actions were skipped because the order changed on another device"

**Color Scheme:**
- **Pending** = Amber (waiting to sync)
- **Syncing** = Blue (currently syncing)
- **Success** = Green (sync successful)
- **Failed** = Red (technical error, can retry)
- **Conflict** = Orange (business conflict, cannot retry)

---

## Testing Scenarios

### Test 1: No Conflicts (Baseline)
**Setup:**
- Single device operation
- Normal offline → online flow

**Expected:**
- All actions: pending → syncing → success
- No conflict statuses
- Normal sync behavior unchanged

### Test 2: Order Closed on Another Device
**Setup:**
1. Device A: Go offline
2. Device B: Close Order #123 (set status to CLOSED)
3. Device A: Queue payment for Order #123 while offline
4. Device A: Go online → sync

**Expected:**
- Conflict detected: "Order is already CLOSED on server"
- Payment action skipped (not sent to backend)
- Action marked as conflict (orange badge)
- Action removed from queue
- Conflict details include orderId and serverStatus

### Test 3: Order Voided on Another Device
**Setup:**
1. Device A: Go offline
2. Device B: Void Order #456
3. Device A: Queue "Send to Kitchen" for Order #456 while offline
4. Device A: Go online → sync

**Expected:**
- Conflict detected: "Order is already VOIDED on server"
- Send action skipped
- Action marked as conflict
- Cannot retry (permanently skipped)

### Test 4: Failed vs Conflict
**Simulate 500 Error:**
- Queue action for open order
- Simulate server error during sync
- Expected: Shows as failed (red), can retry

**Simulate Conflict:**
- Queue action for closed order
- Sync with conflict detection
- Expected: Shows as conflict (orange), cannot retry

### Test 5: Background Sync with Conflicts
**Setup:**
- Same as Test 2, but use Background Sync (no manual button)
- Service Worker handles sync automatically

**Expected:**
- Conflict detected automatically in background
- User sees conflict banner after sync completes
- No dangerous actions sent to server

### Test 6: Safe Actions (No Conflict Check)
**Setup:**
- Queue createOrder action (no orderId yet)
- Go online → sync

**Expected:**
- No conflict check performed (createOrder is safe)
- Action syncs normally
- No unnecessary GET requests

---

## Technical Decisions

### 1. Only Check Risky Actions
**Decision:** Only run conflict detection for actions that modify existing orders
**Rationale:**
- createOrder has no orderId yet, cannot conflict
- Other non-order actions don't need conflict detection
- Reduces unnecessary GET requests
- Improves sync performance

### 2. Final State Detection Only
**Decision:** Only detect CLOSED, VOIDED, CANCELLED, PAID states
**Rationale:**
- These are terminal states where modifications are dangerous
- Other state transitions (NEW → SENT) are generally safe
- Server-side validation handles most other edge cases
- Simplifies conflict detection logic

### 3. Fail Open Strategy
**Decision:** If conflict detection fails, proceed with normal sync
**Rationale:**
- Network error during conflict check shouldn't block all syncs
- Idempotency (M21) protects against duplicate actions
- Better to attempt sync than block operations
- Server-side validation is final authority

### 4. No Retry for Conflicts
**Decision:** Conflicted actions are permanently removed from queue
**Rationale:**
- Conflict means server state incompatible with queued action
- Retrying would produce same conflict
- Different from failed actions which have technical errors
- User needs to manually re-initiate action if desired

### 5. Orange Color for Conflicts
**Decision:** Use orange for conflicts, red for failures
**Rationale:**
- Visual distinction between error types
- Red = technical error (can retry)
- Orange = business conflict (cannot retry)
- Matches common UI patterns for warnings vs errors

### 6. No Backend Changes
**Decision:** Use existing GET endpoint for conflict detection
**Rationale:**
- No API changes needed
- No database schema changes
- No backend deployment required
- Purely frontend enhancement

---

## Bundle Impact

**Before M27-S7:**
- POS page: 9.2 kB
- Total bundle: 136 kB

**After M27-S7:**
- POS page: 9.81 kB (+0.61 kB)
- Total bundle: 137 kB (+1 kB)

**Analysis:**
- Minimal bundle increase (~0.6 kB gzipped)
- Two new helper functions: parseQueueAction + checkOrderConflict
- Extended TypeScript types (no runtime cost)
- UI updates are conditional (no significant size impact)

---

## Architecture Notes

### Conflict Detection Flow

```
1. Queue has pending actions
2. User comes online / triggers sync
3. For each queued action:
   a. Parse action kind and orderId
   b. If orderId exists and action is risky:
      - GET /api/pos/orders/:id
      - Check if status is final
      - If final: mark conflict, skip, remove
   c. If no conflict: proceed with normal sync
4. Update sync log with results
5. Display conflict badges/banners in UI
```

### State Machine

```
Pending → [Conflict Check] → [Decision]
                                 ↓
                    ┌────────────┴────────────┐
                    ↓                         ↓
              Conflict Detected          No Conflict
                    ↓                         ↓
         Mark Conflict, Remove         Normal Sync Flow
                    ↓                         ↓
            Status: 'conflict'      Status: 'syncing' → 'success'/'failed'
```

### Error Handling

**Conflict Detection Errors:**
- Network error during GET: Fail open (proceed with sync)
- 404 Not Found: Fail open (order might be deleted, let server handle)
- Invalid JSON: Fail open (unexpected response, proceed with caution)
- Auth error: Fail open (user session might be expired, let sync fail normally)

**Sync Errors:**
- HTTP 4xx/5xx: Mark as failed (can retry)
- Network error: Mark as failed (can retry)
- Conflict detected: Mark as conflict (cannot retry)

---

## Files Modified

### Core Logic
- `apps/web/src/hooks/useOfflineQueue.ts`
  * Extended SyncStatus type with 'conflict'
  * Extended SyncLogEntry with conflictDetails
  * Added parseQueueAction() helper
  * Added checkOrderConflict() helper
  * Integrated conflict detection into syncQueue loop

### UI Components
- `apps/web/src/components/pos/PosSyncStatusPanel.tsx`
  * Added 'conflict' to statusBadgeColor (orange)
  * Added hasConflicts flag
  * Display conflict badge in header
  * Color conflict error messages orange

### Page
- `apps/web/src/pages/pos/index.tsx`
  * Added conflictCount computation
  * Updated offline banner with conflict badge
  * Added online conflict warning banner

---

## Multi-Device Safety

### Problem Addressed
Without conflict detection, dangerous race conditions could occur:
- Device A offline, tries to pay order that Device B already closed
- Device A offline, tries to void order that Device B already voided
- Device A offline, tries to modify order that Device B already finalized

### Solution Provided
- Read-before-write checks detect server state changes
- Conflicts are caught before dangerous actions reach server
- Clear user feedback explains what happened
- Actions are skipped (not retried) when conflicts detected

### Remaining Server-Side Safety
- Idempotency (M21) prevents duplicate actions
- State machine validation in PosService
- Transaction isolation in database
- Optimistic locking for concurrent updates

**M27-S7 adds an additional safety layer at the client level.**

---

## Integration with Existing Features

### M27-S1: Offline Queue
- Conflict detection runs during sync
- Compatible with manual sync button
- Works with localStorage queue

### M27-S2: Background Sync
- Conflict detection runs automatically
- Works with Service Worker sync events
- No user intervention needed

### M27-S3: Local Cache
- Conflict detection queries fresh server state
- Cache not used for conflict detection
- Always checks latest server data

### M27-S4: Sync Status UI
- Conflict status displayed in sync panel
- Orange badges distinguish from failures
- Detailed conflict information shown

### M21: Idempotency
- Conflict detection is complementary
- Idempotency handles duplicates
- Conflict detection handles stale state

---

## Future Enhancements (Not in M27-S7 Scope)

### Potential Improvements
1. **Smart Merge:** Attempt to merge compatible changes instead of skipping
2. **Conflict Resolution UI:** Let user choose how to resolve conflicts
3. **Server-Side Conflict Detection:** Implement conflict detection in backend
4. **Versioning:** Use order version numbers for optimistic locking
5. **Diff View:** Show what changed on server vs queued action
6. **Undo Conflicts:** Allow user to undo conflicting server changes
7. **Batch Conflict Checks:** Detect conflicts for all actions in single API call

### Why Not Implemented Now
- **Complexity:** Smart merge requires sophisticated diffing logic
- **Scope:** M27-S7 focused on safety and visibility, not smart resolution
- **User Flow:** Manual re-initiation is acceptable for rare conflicts
- **Backend Changes:** Server-side solutions require API changes (out of scope)

**Current implementation prioritizes safety and simplicity over automation.**

---

## Documentation

### For Developers

**Adding New Risky Actions:**
1. Update `parseQueueAction()` with new URL pattern
2. Ensure action kind is in `riskyActions` array in `checkOrderConflict()`
3. No other changes needed

**Adding New Final States:**
1. Update `finalStates` array in `checkOrderConflict()`
2. Test conflict detection with new state

**Debugging Conflicts:**
1. Open sync panel to see conflict details
2. Check `conflictDetails.reason` for explanation
3. Check `conflictDetails.serverStatus` for actual server state
4. Check `conflictDetails.orderId` to identify order

### For Users

**What is a Conflict?**
- A conflict occurs when an order changed on another device
- Example: You tried to pay an order that someone else already closed
- Conflicts are shown with orange badges
- Conflicted actions cannot be retried (they're skipped)

**How to Handle Conflicts:**
1. Open "View sync details" to see what happened
2. Read the conflict reason (e.g., "Order is already CLOSED on server")
3. If needed, manually re-initiate the action with fresh order state
4. Conflicts are rare in normal operation

**Conflict vs Failed:**
- **Failed** (red) = Technical error, can retry (network timeout, server error)
- **Conflict** (orange) = Business conflict, cannot retry (order state changed)

---

## Success Criteria

✅ **Conflict Detection Implemented:**
- parseQueueAction() extracts action kind and orderId
- checkOrderConflict() queries server for order state
- syncQueue loop integrates conflict detection

✅ **Dangerous Actions Prevented:**
- payOrder skipped if order already closed
- voidOrder skipped if order already voided
- updateItems/addItems skipped if order finalized

✅ **Clear User Feedback:**
- Orange badges for conflicts
- Detailed conflict information in sync panel
- Conflict warning banners when online
- Distinction between failed and conflicted actions

✅ **No Backend Changes:**
- Uses existing GET /api/pos/orders/:id endpoint
- No API changes
- No database schema changes
- Purely frontend enhancement

✅ **Build Verification:**
- TypeScript compilation: 0 errors
- ESLint: 0 errors
- Production build: Success
- Bundle size: 9.81 kB (minimal increase)

---

## M27 Series Progress

- ✅ **M27-S1:** Offline queue with localStorage - Manual sync
- ✅ **M27-S2:** Service Worker with Background Sync - Automatic sync
- ✅ **M27-S3:** IndexedDB caching - Offline-first data
- ✅ **M27-S4:** Sync status UI - Per-action tracking
- ✅ **M27-S7:** Conflict detection - Multi-device safety

**POS Offline Resilience: COMPLETE**

---

## Completion Summary

Successfully implemented conflict detection for POS offline queue with read-before-write checks. System now detects when orders have been closed/voided on other devices and skips dangerous actions with clear conflict marking. Provides multi-device safety without backend changes.

**Bundle Impact:** +0.61 kB (9.81 kB total for POS page)  
**Build Status:** ✅ 0 errors, production-ready  
**Testing:** Ready for multi-device conflict scenarios

**M27-S7: COMPLETE** 🎉
