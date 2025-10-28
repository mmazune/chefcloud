# A6a-s2 Implementation Summary

## Objective

Upgrade desktop offline queue from localStorage to SQLite with background sync and comprehensive testing.

## Completed Tasks

### 1. SQLite Integration ✅

- **Package**: Installed `better-sqlite3@12.4.1` and `@types/better-sqlite3@7.6.13`
- **Database Location**: `{appDataDir}/offline-queue.db`
  - Linux: `~/.local/share/chefcloud/offline-queue.db`
  - macOS: `~/Library/Application Support/chefcloud/offline-queue.db`
  - Windows: `C:\Users\{username}\AppData\Roaming\chefcloud\offline-queue.db`

### 2. Database Schema ✅

```sql
CREATE TABLE ops (
  id TEXT PRIMARY KEY,           -- clientOpId (UUID)
  type TEXT NOT NULL,            -- Operation type (CREATE_ORDER, etc.)
  payload TEXT NOT NULL,         -- JSON stringified request body
  clientOrderId TEXT,            -- Nullable, for order tracking
  at TEXT NOT NULL               -- ISO timestamp
)
```

### 3. Core Files Created ✅

#### `src/lib/offline-db.ts`

SQLite wrapper with CRUD operations:

- `getDb()` - Lazy-init connection with table creation
- `dbEnqueue(op)` - INSERT operation
- `dbDequeueMany(limit)` - SELECT batch with LIMIT
- `dbRemove(clientOpIds[])` - DELETE by IDs
- `dbCount()` - COUNT(\*) for queue size
- `dbAll()` - SELECT \* ORDER BY at ASC
- `dbClear()` - DELETE FROM ops
- `closeDb()` - Close database connection

#### `src/lib/client-map.ts`

Persistent ID mapping in `{appDataDir}/client-map.json`:

- `loadClientIdMap()` - Read from JSON file
- `saveClientIdMap(map)` - Write to JSON file
- `addMapping(clientOrderId, serverOrderId)` - Add mapping
- `getServerOrderId(clientOrderId)` - Lookup server ID

#### `src/lib/sync.ts`

Background automatic sync loop:

- `startSyncLoop()` - 10s interval with exponential backoff
  - Checks `navigator.onLine` before syncing
  - Checks `dbCount() > 0` before flushing
  - Exponential backoff on errors (doubles delay, max 60s)
  - Resets to 10s on success or empty queue
- `stopSyncLoop()` - Clear interval
- `getSyncStatus()` - Return running status and current backoff

### 4. Modified Files ✅

#### `src/lib/offline-queue.ts`

- Converted all methods from sync to async (Promise-based)
- Delegates to SQLite via `offline-db.ts`
- Payload type changed from `any` to `unknown`
- Maintains same API surface: `getAll()`, `getCount()`, `enqueue()`, `clear()`, `replaceAll()`

#### `src/lib/api-wrapper.ts`

- Updated for async queue methods
- Added `BatchResultItem` interface with `serverId` property
- `sendOrQueue()` calls `addMapping()` when sync succeeds with serverId
- `flushAll()` rewritten to use `dbDequeueMany()/dbRemove()` pattern (more efficient)
- Processes batches using DB queries instead of loading all ops into memory
- Updates client ID mappings on successful sync

#### `src/App.tsx`

- Updated to use async queue methods (`await queue.enqueue()`, `await queue.getCount()`)

#### `src/components/OfflineBadge.tsx`

- Updated `updateQueueCount()` to be async
- Removed unused `queue` parameter from `flushAll()` call
- Fixed TypeScript error handling

### 5. Test Suite ✅

Created comprehensive vitest tests in `test/`:

#### `test/offline-queue.test.ts`

- Queue persistence across restarts (close/reopen DB)
- Enqueue and count operations
- Retrieve all operations in order
- Clear all operations
- Replace all operations

#### `test/client-map.test.ts`

- Load empty map when file doesn't exist
- Load existing map from file
- Save map to file
- Add new mapping and persist
- Retrieve server order ID
- Return null for unknown client ID

#### `test/api-wrapper.test.ts`

- Send request when online
- Queue request when fetch fails
- Flush queued operations when online
- Handle partial flush failures

**Test Results**: ✅ 26/26 tests passing

### 6. Documentation ✅

#### Updated `README.md`

Added comprehensive offline mode documentation:

- SQLite storage locations by platform
- Background sync loop details (10s interval, exponential backoff)
- Idempotency mechanism
- Client ID mapping explanation
- Offline testing instructions (including `iptables` commands for Linux)

## Build Status ✅

```bash
pnpm --filter @chefcloud/desktop build
✓ built in 1.17s
```

## Test Status ✅

```bash
pnpm --filter @chefcloud/desktop test
Test Files  5 passed (5)
Tests  26 passed (26)
```

## Key Improvements Over A6a-s1

1. **Persistence**: SQLite database survives app restarts (vs localStorage)
2. **Performance**: Batch processing with `dbDequeueMany(25)` instead of loading all ops
3. **Automatic Sync**: Background loop runs every 10s without user intervention
4. **Resilience**: Exponential backoff prevents server hammering during outages
5. **ID Tracking**: Client-to-server ID mapping for order lifecycle management
6. **Type Safety**: Proper TypeScript interfaces for batch results
7. **Testing**: Comprehensive test suite with 26 tests covering all components

## Next Steps (Future)

- [ ] Add sync status indicator to UI (show backoff state)
- [ ] Implement conflict resolution for concurrent edits
- [ ] Add metrics/telemetry for sync success rates
- [ ] Optimize batch size based on network conditions
- [ ] Add retry with jitter to prevent thundering herd
- [ ] Implement offline mutation optimistic UI updates

## Architecture Notes

### Why SQLite?

- Production-grade persistence (ACID compliance)
- Better performance for large queues
- Cross-platform support via better-sqlite3
- No external dependencies (embedded database)

### Why Background Sync?

- User doesn't need to manually trigger sync
- Automatic recovery from temporary network issues
- Exponential backoff prevents server overload
- Respects `navigator.onLine` API

### Why Client ID Mapping?

- Frontend can assign UUIDs immediately (no server roundtrip)
- Track orders across sync boundary
- Enable offline order status lookups
- Support refunds/modifications using client IDs
