# Desktop Printer Test Instructions

## Prerequisites

The desktop app uses Tauri, which requires GTK3 and webkit2gtk on Linux. In production environments these are typically pre-installed, but in devcontainer/codespace environments you can test the TypeScript/React portion.

## Running the Desktop App (Development)

### Option 1: Development Mode (React only, no Tauri shell)

```bash
cd apps/desktop
PRINTER_SIMULATE=true pnpm dev
```

This starts the Vite dev server at http://localhost:5173. You can test the UI but Tauri commands won't work.

### Option 2: Full Tauri Mode (requires GTK3)

```bash
cd apps/desktop
PRINTER_SIMULATE=true pnpm tauri dev
```

This builds and runs the full Tauri application with the Rust backend.

## Testing the Printer

### Simulate Mode (Default)

The printer is in simulate mode by default. When you click "Test Print":

1. The app will encode a test receipt as Base64
2. Send it to the Rust backend via Tauri IPC
3. The backend will decode it and log: `PRINT BYTES n` (where n = byte count)
4. An alert will show: "Print successful: Simulated print: n bytes"

Check the terminal output for the `PRINT BYTES` log.

### Real Printer Mode

To print to an actual ESC/POS network printer:

```bash
# Set environment variables
export PRINTER_HOST=192.168.1.100  # Your printer's IP
export PRINTER_PORT=9100           # Usually 9100 for ESC/POS
export PRINTER_SIMULATE=false

# Run the app
cd apps/desktop
pnpm tauri dev
```

Or create `~/.chefcloud/printer.json`:

```json
{
  "host": "192.168.1.100",
  "port": 9100,
  "simulate": false
}
```

Then run normally:

```bash
cd apps/desktop
pnpm tauri dev
```

## Testing

Run the unit tests:

```bash
cd apps/desktop
pnpm test
```

Expected output:
```
✓ test/printer.test.ts (7 tests)
✓ test/printer-simulate.test.ts (3 tests)

Test Files  2 passed (2)
     Tests  10 passed (10)
```

## Building for Production

```bash
cd apps/desktop
pnpm tauri build
```

The built application will be in `src-tauri/target/release/`.

## Troubleshooting

### "Can't find module @tauri-apps/api"
Run `pnpm install` in the workspace root.

### Printer not responding
1. Verify printer is on the network: `ping <PRINTER_IP>`
2. Check port 9100 is open: `nc -zv <PRINTER_IP> 9100`
3. Try simulate mode first to verify the app works
4. Check printer supports ESC/POS protocol

### Build fails with GTK errors
This is expected in Codespaces/containers without GUI support. The TypeScript code compiles successfully. For production builds, use a machine with GTK3 development libraries installed.

## Architecture

```
┌─────────────────┐
│  React UI       │
│  (TypeScript)   │
└────────┬────────┘
         │ Tauri IPC
         │ invoke('print_receipt', {base64Data})
         ▼
┌─────────────────┐
│  Rust Backend   │
│  • Load config  │
│  • Decode b64   │
│  • TCP/simulate │
└────────┬────────┘
         │
    ┌────┴────┐
    ▼         ▼
┌────────┐  ┌────────┐
│ stdout │  │ TCP    │
│ log    │  │ :9100  │
└────────┘  └────────┘
```
