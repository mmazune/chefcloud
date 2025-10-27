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

# Run in development mode
pnpm dev

# Build for production
pnpm build
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
