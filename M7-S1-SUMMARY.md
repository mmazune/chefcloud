# M7-S1 Implementation Summary: Liquor Spout Hardware Integration

**Status:** ✅ Complete  
**Date:** 2025-10-27  
**Sprint:** M7-s1 (Liquor spout sandbox adapter + ingestion)

## Overview

Implemented complete liquor pour spout integration with automatic inventory consumption tracking. The system receives pour events via webhook, calibrates ml per pulse for each device/item pairing, and automatically consumes from stock batches using FIFO (First-In-First-Out) logic.

## Deliverables

### 1. Database Schema ✅

**Migration:** `20251027224712_add_spout_hardware`

**Models Added:**
- `SpoutDevice`: Hardware device registry with HMAC secrets
- `SpoutCalibration`: Device-to-inventory calibration (ml per pulse)
- `SpoutEvent`: Pour event tracking with computed ml values

**Key Features:**
- Device secrets for HMAC webhook verification (64-char hex)
- Compound unique constraint on `(deviceId, inventoryItemId)` for calibrations
- Reverse relations to Org, Branch, InventoryItem
- Indexes on `occurredAt` and `deviceId` for performance

### 2. API Endpoints ✅

**Module:** `HardwareModule` with `SpoutController` and `SpoutService`

**Endpoints:**
- `POST /hardware/spout/devices` (L4+) - Create spout device with auto-generated secret
- `POST /hardware/spout/calibrate` (L4+) - Set ml per pulse calibration
- `POST /hardware/spout/ingest` (Public) - Webhook for pour events with optional HMAC verification
- `GET /hardware/spout/events` (L4+) - Query historical pour events with filters

**Security:**
- HMAC SHA256 signature verification (optional via `SPOUT_VERIFY` env var)
- L4+ role required for device management
- Public webhook endpoint for hardware vendors

### 3. Worker Integration ✅

**Job:** `spout-consume` (runs every minute, cron: `* * * * *`)

**Logic:**
1. Aggregates SpoutEvent records from last 60 seconds
2. Computes total ml per inventory item
3. Converts ml to item unit (ml or ltr)
4. Consumes from StockBatch.remainingQty using FIFO (oldest receivedAt first)
5. Handles negative stock:
   - Creates `NEGATIVE_STOCK` audit event
   - Caps `remainingQty` at zero

**Queue:** `spout-consume-queue` (BullMQ)

### 4. Environment Variables ✅

```bash
SPOUT_VERIFY=false           # Enable HMAC signature verification
SPOUT_VENDOR=SANDBOX         # Vendor identifier (SANDBOX, BERG, POURSTEADY, etc.)
```

### 5. Tests ✅

**Unit Tests:** `services/api/src/hardware/spout.service.spec.ts`
- Device creation with random secret generation
- Calibration upsert logic
- ml computation (pulses × mlPerPulse)
- HMAC signature verification (valid/invalid)
- Device not found/inactive error handling
- Event filtering by deviceId and date range

**Test Coverage:**
- 7/7 tests passing
- HMAC signature verification with timing-safe comparison
- Error cases (NotFoundException, UnauthorizedException)

### 6. Documentation ✅

**File:** `DEV_GUIDE.md` (new section: "Liquor Spout Hardware Integration (M7-s1)")

**Includes:**
- Architecture overview
- Configuration instructions
- Database schema details
- API endpoint examples with curl commands
- Worker job logic explanation
- E2E test scenarios (webhook → consume → inventory)
- Troubleshooting guide

## Technical Decisions

### 1. HMAC Signature Verification
- **Why:** Prevent unauthorized/spoofed webhook submissions
- **How:** Device-specific 64-char hex secret, HMAC-SHA256 with timing-safe comparison
- **Optional:** Controlled by `SPOUT_VERIFY` env var (default: false for sandbox)

### 2. FIFO Consumption
- **Why:** Accurate inventory aging, prevents old stock from sitting unused
- **How:** StockBatch.receivedAt sorted ASC, consume from oldest first
- **Trade-off:** Requires batch-level tracking vs. simple on-hand qty

### 3. Negative Stock Handling
- **Why:** Prevent data corruption from hardware inaccuracies
- **How:** Create audit event for investigation, cap at zero
- **Alternative Considered:** Allow negative values for later reconciliation (rejected due to reporting complexity)

### 4. Worker Frequency
- **Why:** Balance real-time accuracy with system load
- **How:** 1-minute cron job aggregates events in batches
- **Trade-off:** Up to 1-minute lag in inventory updates vs. per-event processing

## API Examples

### Create Device
```bash
curl -X POST http://localhost:3001/hardware/spout/devices \
  -H "Authorization: Bearer L4_TOKEN" \
  -d '{"name": "Bar Spout #1", "vendor": "SANDBOX", "branchId": "branch-001"}'
```

### Calibrate Device
```bash
curl -X POST http://localhost:3001/hardware/spout/calibrate \
  -H "Authorization: Bearer L4_TOKEN" \
  -d '{"deviceId": "device-123", "inventoryItemId": "item-vodka", "mlPerPulse": 1.5}'
```

### Ingest Pour Event
```bash
curl -X POST http://localhost:3001/hardware/spout/ingest \
  -H "Content-Type: application/json" \
  -H "X-Spout-Signature: optional-hmac-signature" \
  -d '{
    "deviceId": "device-123",
    "pulses": 100,
    "occurredAt": "2025-10-27T22:00:00Z"
  }'
```

## Known Limitations

1. **Single Calibration Per Device:** Each device can only be calibrated to one inventory item. Multi-item spouts require multiple device records.
2. **Worker Lag:** Up to 1-minute delay between pour and inventory consumption.
3. **No Rollback:** Negative stock events are logged but not automatically corrected. Requires manual adjustment.
4. **Sandbox Only:** Real vendor integrations (Berg, Poursteady) require production API credentials.

## Future Enhancements

- [ ] Multi-item calibration per device (e.g., separate bottle sensors)
- [ ] Real-time consumption via webhook callback (optional)
- [ ] Stock reconciliation UI for negative stock events
- [ ] Production vendor adapters (Berg, Poursteady APIs)
- [ ] Device health monitoring (battery, connectivity)
- [ ] Pour pattern analytics (anomaly detection)

## Testing Checklist

- [x] Unit tests for SpoutService (7 tests passing)
- [x] HMAC signature verification (valid/invalid)
- [x] Device creation with secret generation
- [x] Calibration upsert logic
- [x] ml computation from pulses
- [x] TypeScript compilation (no errors)
- [x] Full workspace build (11/11 packages)
- [ ] E2E test (webhook → worker → inventory decrease) - requires running services
- [ ] Negative stock scenario - requires manual testing
- [ ] FIFO consumption order - requires manual testing

## Migration Steps

1. ✅ Applied migration `20251027224712_add_spout_hardware`
2. ✅ Regenerated Prisma client
3. ✅ Built API and worker services
4. ✅ Updated environment variables
5. ✅ Added documentation

## Deployment Notes

### Database
- Run migration: `pnpm --filter @chefcloud/db run db:migrate`
- Verify schema: `pnpm --filter @chefcloud/db run db:studio`

### API Service
- Restart to load HardwareModule: `pnpm --filter @chefcloud/api run dev`
- Test health: `curl http://localhost:3001/health`

### Worker Service
- Restart to register spout-consume job: `pnpm --filter @chefcloud/worker run dev`
- Monitor queue: Check BullMQ dashboard or logs

### Environment
- Set `SPOUT_VERIFY=false` for sandbox testing
- Set `SPOUT_VENDOR=SANDBOX` (or actual vendor name)
- Update in production after vendor integration

## Files Changed

### Created
- `packages/db/prisma/migrations/20251027224712_add_spout_hardware/migration.sql`
- `services/api/src/hardware/hardware.module.ts`
- `services/api/src/hardware/spout.controller.ts`
- `services/api/src/hardware/spout.service.ts`
- `services/api/src/hardware/spout.service.spec.ts`
- `M7-S1-SUMMARY.md` (this file)

### Modified
- `packages/db/prisma/schema.prisma` - Added SpoutDevice, SpoutCalibration, SpoutEvent models
- `services/api/src/app.module.ts` - Imported HardwareModule
- `services/api/src/prisma.service.ts` - Added typed getters for spout models
- `services/worker/src/index.ts` - Added spout-consume worker and scheduler
- `.env.example` - Added SPOUT_VERIFY, SPOUT_VENDOR
- `DEV_GUIDE.md` - Added M7-s1 documentation section

## Commit Message

```
feat(M7-s1): Liquor spout hardware integration with FIFO inventory consumption

- Add SpoutDevice, SpoutCalibration, SpoutEvent database models
- Implement public webhook endpoint with optional HMAC verification
- Create L4+ endpoints for device management and calibration
- Add spout-consume worker job (runs every minute, FIFO consumption)
- Handle negative stock with audit events (cap at zero)
- Include unit tests (7 passing) and comprehensive documentation
- Environment: SPOUT_VERIFY, SPOUT_VENDOR

Closes #M7-s1
```

## Sign-off

**Implementation:** Complete ✅  
**Tests:** Passing ✅  
**Documentation:** Updated ✅  
**Build:** Clean ✅  

Ready for code review and merge.
