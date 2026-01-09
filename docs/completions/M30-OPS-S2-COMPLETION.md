# M30-OPS-S2: Diagnostics JSON Snapshot Export - COMPLETION SUMMARY

**Date:** 2025-01-XX  
**Milestone:** M30 (Operations & Support)  
**Step:** S2 - Diagnostics JSON Export  
**Status:** ✅ COMPLETE

---

## Overview

Extended the existing POS/KDS diagnostics panel with structured JSON snapshot export capabilities, enabling support and engineering teams to capture comprehensive device/app state with a single click.

### Features Delivered

1. **DiagnosticsSnapshot Interface**
   - Comprehensive TypeScript type covering all diagnostic data
   - Includes: app version, device role, online status, kiosk mode, offline queue metrics, cache status, storage usage, and full environment details
   - 65+ line structured interface ensuring type safety

2. **JSON Serialization**
   - `serializeDiagnosticsSnapshot()` function producing pretty-printed JSON
   - 2-space indentation for readability
   - Suitable for both clipboard and file download

3. **Copy to Clipboard**
   - "Copy JSON" button with visual feedback ("Copied to clipboard" message for 2s)
   - Uses modern Clipboard API with fallback to `document.execCommand('copy')`
   - Silent error handling for graceful degradation

4. **Download as File**
   - "Download JSON" button creates downloadable file
   - Smart filename: `chefcloud-{context}-diagnostics-{timestamp}.json`
   - Example: `chefcloud-pos-diagnostics-2025-01-15T14-30-45-123Z.json`
   - Uses Blob API and URL.createObjectURL

5. **Support Tools UI Section**
   - Dedicated section in diagnostics panel
   - Clear description: "Use these actions when talking to support or engineers. It is safe to share the exported JSON."
   - Consistent button styling matching existing design system

---

## Files Modified

### 1. **apps/web/src/lib/diagnostics.ts**
**Changes:**
- Added `DiagnosticsSnapshot` interface (65+ lines)
  - `appVersion`, `context`, `timestampIso`
  - `deviceRole`, `online`
  - `kiosk: { supported, active }`
  - `offlineQueue: { queuedCount, failedCount, conflictCount, historyCount }`
  - `cache: { menuItemsCount, menuStale, menuAgeMs, openOrdersCount, openOrdersStale, openOrdersAgeMs }`
  - `storage: { usageBytes, quotaBytes }`
  - `environment: { userAgent, platform, serviceWorkerSupported, language, locationHref, screen, nodeEnv, apiBaseUrl }`
- Added `serializeDiagnosticsSnapshot(snapshot: DiagnosticsSnapshot): string`
  - Returns `JSON.stringify(snapshot, null, 2)` for pretty printing

### 2. **apps/web/src/lib/diagnostics.test.ts**
**Changes:**
- Added test: "serializeDiagnosticsSnapshot produces pretty JSON"
  - Creates comprehensive test snapshot
  - Asserts presence of key fields (`appVersion`, `context`)
  - Verifies multi-line formatting
- **Test Results:** 3/3 passing

### 3. **apps/web/src/components/common/SystemDiagnosticsPanel.tsx**
**Changes:**
- Updated imports: added `DiagnosticsSnapshot` type and `serializeDiagnosticsSnapshot` function
- Added `copied` state: `const [copied, setCopied] = React.useState(false)`
- Created `snapshot` object using `React.useMemo` with proper dependencies
  - Constructs full `DiagnosticsSnapshot` from hook data
  - Memoized to prevent unnecessary re-renders
- Added `handleCopyJson` callback:
  - Serializes snapshot to JSON
  - Uses Clipboard API with fallback
  - Shows "Copied to clipboard" feedback for 2 seconds
- Added `handleDownloadJson` callback:
  - Creates Blob from serialized JSON
  - Generates timestamp-based filename
  - Triggers browser download
- Added "Support tools" UI section:
  - Positioned after Environment section (spans 2 columns on md+ screens)
  - Contains Copy JSON and Download JSON buttons
  - Displays "Copied to clipboard" feedback message

**React Hooks Compliance:**
- All hooks called before early return (`if (!open) return null`)
- `snapshot` wrapped in `useMemo` with comprehensive dependency array
- Handlers use `useCallback` with `snapshot` dependency
- No conditional hook calls

### 4. **apps/web/src/components/common/SystemDiagnosticsPanel.test.tsx**
**Changes:**
- Updated existing test: "renders key sections when open"
  - Added assertions for Copy JSON button
  - Added assertions for Download JSON button
- Added new test: "copy JSON uses clipboard when available"
  - Mocks `navigator.clipboard.writeText`
  - Clicks Copy JSON button
  - Verifies clipboard API called
- **Test Results:** 2/2 passing

---

## Test Results

### Unit Tests
```
Test Suites: 20 passed, 20 total
Tests:       193 passed, 193 total
```

**New Tests Added:** +2 tests
- diagnostics.test.ts: serializeDiagnosticsSnapshot test
- SystemDiagnosticsPanel.test.tsx: clipboard copy test

### Lint
```
✅ Passed
```
Only pre-existing warnings (unused React imports in unrelated test files)

### Build
```
✅ Successful
```
No TypeScript errors, minimal bundle size increase

---

## Technical Implementation

### Snapshot Structure Example

```json
{
  "appVersion": "0.1.0",
  "context": "POS",
  "timestampIso": "2025-01-15T14:30:45.123Z",
  "deviceRole": "POS",
  "online": true,
  "kiosk": {
    "supported": true,
    "active": false
  },
  "offlineQueue": {
    "queuedCount": 0,
    "failedCount": 0,
    "conflictCount": 0,
    "historyCount": 5
  },
  "cache": {
    "menuItemsCount": 42,
    "menuStale": false,
    "menuAgeMs": 3600000,
    "openOrdersCount": 3,
    "openOrdersStale": false,
    "openOrdersAgeMs": 120000
  },
  "storage": {
    "usageBytes": 1048576,
    "quotaBytes": 10485760
  },
  "environment": {
    "userAgent": "Mozilla/5.0 ...",
    "platform": "MacIntel",
    "serviceWorkerSupported": true,
    "language": "en-US",
    "locationHref": "http://localhost:3000/pos",
    "screen": {
      "width": 1920,
      "height": 1080
    },
    "nodeEnv": "production",
    "apiBaseUrl": "http://localhost:4000"
  }
}
```

### Clipboard API Implementation

**Primary Method:**
```typescript
if (navigator?.clipboard?.writeText) {
  await navigator.clipboard.writeText(payload);
}
```

**Fallback Method:**
```typescript
const el = document.createElement('textarea');
el.value = payload;
document.body.appendChild(el);
el.select();
document.execCommand('copy');
document.body.removeChild(el);
```

### Download Implementation

```typescript
const blob = new Blob([payload], { type: 'application/json' });
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
const timestamp = snapshot.timestampIso.replace(/[:.]/g, '-');
a.href = url;
a.download = `chefcloud-${context.toLowerCase()}-diagnostics-${timestamp}.json`;
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
URL.revokeObjectURL(url);
```

---

## Usage Instructions

### For Restaurant Staff

1. **Access Diagnostics Panel:**
   - On POS: Click "Diagnostics" button in app header
   - On KDS: Click "Diagnostics" button in app header

2. **Copy to Clipboard:**
   - Scroll to "Support tools" section
   - Click "Copy JSON" button
   - Look for "Copied to clipboard" confirmation
   - Paste into support ticket, email, or chat

3. **Download as File:**
   - Scroll to "Support tools" section
   - Click "Download JSON" button
   - File automatically downloads to default download folder
   - Attach file to support ticket

### For Support/Engineering

1. **Request Snapshot:**
   - Ask user to open diagnostics panel
   - Guide them to click "Copy JSON" or "Download JSON"
   - Have them send/paste the JSON data

2. **Analyze Snapshot:**
   - Check `online` status for connectivity issues
   - Review `offlineQueue` for sync problems
   - Examine `cache` staleness indicators
   - Check `storage` quota for capacity issues
   - Review `environment` for browser/platform specifics

---

## Future Enhancements (Not in Scope)

- **Backend Upload:** POST snapshot to `/api/support/diagnostics` for centralized logging
- **Screenshot Capture:** Include visual state alongside JSON data
- **Automated Reporting:** Email snapshots on critical errors
- **Historical Comparison:** Compare snapshots across time
- **Privacy Filtering:** Redact sensitive fields before export

---

## Verification Checklist

- [x] DiagnosticsSnapshot interface created with comprehensive fields
- [x] serializeDiagnosticsSnapshot function implemented
- [x] Copy JSON button functional with clipboard API
- [x] Copy JSON button shows "Copied to clipboard" feedback
- [x] Download JSON button creates properly named file
- [x] Filename includes context and sanitized timestamp
- [x] Support tools section renders in diagnostics panel
- [x] Unit tests added for serializer
- [x] Component tests added for buttons and clipboard
- [x] All 193 tests passing (+2 new tests)
- [x] Lint passing (only pre-existing warnings)
- [x] Build successful
- [x] React Hooks compliance (no conditional hooks)
- [x] TypeScript type safety maintained

---

## Related Documents

- **M30-OPS-S1-COMPLETION.md:** Initial diagnostics panel implementation
- **ChefCloud_Engineering_Blueprint_v0.1.md:** M30 milestone overview
- **DEV_GUIDE.md:** Testing and development guidelines

---

## Commit Message

```
feat(diagnostics): add JSON snapshot export to diagnostics panel

- Add DiagnosticsSnapshot interface covering all diagnostic data
- Implement serializeDiagnosticsSnapshot for pretty-printed JSON
- Add Copy JSON button with clipboard API and fallback
- Add Download JSON button with smart filename generation
- Add Support tools section to diagnostics panel UI
- Add tests for serializer and clipboard functionality
- Fix React Hooks compliance with useMemo for snapshot

M30-OPS-S2: JSON export enables support teams to capture
comprehensive device/app state with one click for remote
troubleshooting.

Tests: 193 passing (+2 new)
```

---

**Implementation Complete** ✅  
**Pure Frontend** ✅ (No backend changes required)  
**Production Ready** ✅
