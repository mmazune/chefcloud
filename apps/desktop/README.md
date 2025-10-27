# ChefCloud Desktop

Desktop POS terminal built with Tauri (Rust) + React.

## Features

- Offline-first architecture with local SQLite
- Idle screensaver (120s timeout)
- ESC/POS receipt printing via TCP or USB
- Secure IPC communication with Tauri commands

## Development

```bash
# Install dependencies
pnpm install

# Copy environment config
cp .env.sample .env

# Run in development mode (requires API server running)
pnpm dev

# Build for production
pnpm build
```

## Offline Mode Demo

The desktop app can operate fully offline and sync when connectivity is restored.

### Prerequisites

1. API server must be running: `cd services/api && pnpm dev`
2. Desktop app: `cd apps/desktop && pnpm dev`

### Testing Offline Mode

1. **While Online:**
   - Click "Create Demo Order (Burger + Fries)"
   - Should show: ✓ Order created
   - Badge shows: "Online"

2. **Simulate Offline:**
   - Stop the API server (`Ctrl+C` in services/api)
   - Or use Chrome DevTools: F12 → Network → "Offline"
   - Or block port 3001: `sudo iptables -A OUTPUT -p tcp --dport 3001 -j DROP` (Linux)
   - Click "Create Demo Order" again
   - Should show: ⏳ Order queued for sync
   - Badge shows: "Offline · 1" (or higher count)

3. **Sync When Back Online:**
   - Restart API server (or unblock port: `sudo iptables -D OUTPUT -p tcp --dport 3001 -j DROP`)
   - Badge automatically syncs every 10 seconds
   - Or click "Sync" button in the badge for immediate flush
   - Queued operations flush to server
   - Badge returns to: "Online"

### How It Works

- **SQLite Persistence**: Operations stored in `{appDataDir}/offline-queue.db` with schema:
  - `id` TEXT PRIMARY KEY (clientOpId UUID)
  - `type` TEXT (e.g., "POST /api/orders")
  - `payload` TEXT (JSON stringified request body)
  - `clientOrderId` TEXT (nullable, for order tracking)
  - `at` TEXT (ISO timestamp)

- **Background Sync Loop**: Automatically runs every 10 seconds when queue is not empty:
  - Checks `navigator.onLine` before attempting sync
  - Processes up to 25 operations per batch
  - Exponential backoff on errors (doubles delay, max 60s)
  - Resets to 10s interval on success or empty queue

- **Idempotency**: All operations include `Idempotency-Key` header (clientOpId)
  - Server logs operations in `OperationLog` table
  - Duplicate requests return cached result (deduplicated)
  - Successfully synced ops removed from queue

- **Client ID Mapping**: Track client-assigned IDs across sync boundary
  - Stored in `{appDataDir}/client-map.json`
  - Maps `clientOrderId` → `serverOrderId`
  - Used for order lookup, status checks, refunds

### Storage Locations

- **Queue Database**: `{appDataDir}/offline-queue.db` (SQLite)
- **ID Mapping**: `{appDataDir}/client-map.json` (JSON file)
- **appDataDir** resolves to:
  - Linux: `~/.local/share/chefcloud`
  - macOS: `~/Library/Application Support/chefcloud`
  - Windows: `C:\Users\{username}\AppData\Roaming\chefcloud`

## Configuration

Edit `.env` file (copy from `.env.sample`):

```bash
VITE_API_BASE_URL=http://localhost:3001  # API server URL
VITE_ORG_ID=demo                         # Organization ID
```

## Printer Configuration

The desktop app supports ESC/POS printers via network (TCP) or simulated mode for development.

### Environment Variables

Configure the printer using environment variables:

- `PRINTER_HOST` - Printer IP address (default: `127.0.0.1`)
- `PRINTER_PORT` - Printer port (default: `9100`)
- `PRINTER_SIMULATE` - Simulate printing without hardware (`true` or `false`, default: `true`)

Example:

```bash
PRINTER_HOST=192.168.1.100 PRINTER_PORT=9100 PRINTER_SIMULATE=false pnpm dev
```

### Configuration File

Alternatively, create a config file at `~/.chefcloud/printer.json`:

```json
{
  "host": "192.168.1.100",
  "port": 9100,
  "simulate": false
}
```

### Configuration Priority

1. Environment variables (highest priority)
2. Configuration file (`~/.chefcloud/printer.json`)
3. Defaults (simulate mode enabled)

### Test Printing

Click the "Test Print" button in the app to send a test receipt to the configured printer.

In simulate mode, the print command will log the byte count to the console without sending to actual hardware.

## Supported Printers

Any ESC/POS compatible thermal printer that supports network (TCP/IP) printing on port 9100, including:

- Epson TM series
- Star Micronics
- Bixolon
- Citizen
- Custom VKP80

## Building for Production

```bash
# Build Tauri app (creates installer/app bundle)
pnpm tauri build
```

The built application will be in `src-tauri/target/release/`.

## Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Tauri (Rust)
- **IPC**: Tauri commands for printer communication
- **Printer Protocol**: ESC/POS over TCP/IP
