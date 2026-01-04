# E2E Cross-Platform Gate Runbook

**Version:** 1.0  
**Milestone:** M10.16  
**Last Updated:** 2026-01-05

---

## Overview

The E2E gate runner is designed to work identically on both:
- **Linux** (GitHub Codespaces, CI)
- **Windows** (PowerShell, local development)

This document provides exact commands and troubleshooting steps for both platforms.

---

## Quick Start

### Self-Check (Verify Setup)

Run this first to verify the gate runner can spawn processes correctly:

**Windows PowerShell:**
```powershell
pnpm -C services/api test:e2e:gate:self-check
```

**Linux/macOS:**
```bash
pnpm -C services/api test:e2e:gate:self-check
```

Expected output:
```
🔍 E2E Gate Runner Self-Check (M10.16)

Platform: win32 | linux
PNPM command: pnpm.cmd | pnpm
...
✅ Self-check passed - gate runner is cross-platform ready
```

### Run E2E Gate

**Windows PowerShell:**
```powershell
pnpm -C services/api test:e2e:gate
```

**Linux/macOS:**
```bash
pnpm -C services/api test:e2e:gate
```

### Run with Options

```powershell
# Skip database setup (if already seeded)
pnpm -C services/api test:e2e:gate -- --skipSetup

# Custom timeouts
pnpm -C services/api test:e2e:gate -- --perFileSeconds=180 --totalMinutes=30
```

---

## Cross-Platform Implementation Details

### Command Resolution

The gate runner resolves the `pnpm` command based on platform:

```javascript
const IS_WINDOWS = platform() === 'win32';
const PNPM = IS_WINDOWS ? 'pnpm.cmd' : 'pnpm';
```

This is required because on Windows:
- `spawn('pnpm', ...)` fails with `ENOENT`
- `spawn('pnpm.cmd', ...)` works correctly

### Process Group Handling

Unix and Windows handle process groups differently:

| Feature | Unix | Windows |
|---------|------|---------|
| Process groups | `detached: true` | Not supported |
| Group kill | `process.kill(-pid)` | `child.kill()` |
| Signal support | SIGTERM, SIGKILL | Limited |

The gate runner handles this automatically:

```javascript
if (!IS_WINDOWS && child.pid) {
  process.kill(-child.pid, signal);  // Kill process group
} else {
  child.kill(signal);  // Direct child kill
}
```

---

## Troubleshooting

### ENOENT Error on Windows

**Symptom:**
```
Error: spawn pnpm ENOENT
```

**Cause:** Using `spawn('pnpm', ...)` instead of `spawn('pnpm.cmd', ...)`

**Solution:** Ensure you're using the gate runner from M10.16 or later, which includes cross-platform command resolution.

### Setup Script Fails on Windows

**Symptom:**
```
'bash' is not recognized as an internal or external command
```

**Cause:** `test:e2e:setup` uses `bash test/setup-test-db.sh`

**Solution:** Run setup using WSL or Git Bash:
```powershell
# Option 1: Use Git Bash
& "C:\Program Files\Git\bin\bash.exe" test/setup-test-db.sh

# Option 2: Use WSL
wsl bash test/setup-test-db.sh
```

Or skip setup if database is already seeded:
```powershell
pnpm -C services/api test:e2e:gate -- --skipSetup
```

### Tests Hang / Never Exit

**Symptom:** Gate never completes, stuck on a test file

**Cause:** Open handles in test code (timers, connections, etc.)

**Solution:**
1. Check with `--detectOpenHandles`:
   ```powershell
   pnpm -C services/api test:e2e -- --runInBand --detectOpenHandles --testTimeout=60000 --runTestsByPath test/e2e/YOUR_FILE.e2e-spec.ts
   ```
2. Fix open handles per E2E_OPEN_HANDLE_POLICY.md

### Path Separator Issues

**Symptom:** Test files not found

**Cause:** Hardcoded forward slashes in paths

**Solution:** Use Node.js `path` module:
```javascript
import { join, resolve } from 'path';
const filePath = join('test', 'e2e', 'some-test.e2e-spec.ts');
```

---

## CI Configuration

### GitHub Actions

```yaml
jobs:
  e2e-gate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '22'
          cache: 'pnpm'
      
      - run: pnpm install
      - run: pnpm -C services/api test:e2e:gate:self-check
      - run: pnpm -C services/api test:e2e:gate
        timeout-minutes: 30
```

### Local Windows CI (PowerShell)

```powershell
# Pre-flight check
pnpm -C services/api test:e2e:gate:self-check

# Run gate with 30-minute timeout
$job = Start-Job { pnpm -C services/api test:e2e:gate }
$completed = Wait-Job $job -Timeout 1800
if (-not $completed) {
    Stop-Job $job
    Write-Error "Gate timed out after 30 minutes"
    exit 1
}
Receive-Job $job
```

---

## Gate Artifacts

After running, the gate produces:

| File | Description |
|------|-------------|
| `.e2e-gate.log` | Full console output log |
| `.e2e-gate-setup.log` | Database setup output |
| `.e2e-matrix.json` | JSON results with per-file timings |

---

## Related Documentation

- [E2E_NO_HANG_STANDARD.md](E2E_NO_HANG_STANDARD.md) - No-hang enforcement policy
- [E2E_OPEN_HANDLE_POLICY.md](E2E_OPEN_HANDLE_POLICY.md) - Open handle prevention
- [E2E_TESTING_STANDARD.md](E2E_TESTING_STANDARD.md) - General E2E standards
- [MILESTONE_DEFINITION_OF_DONE.md](MILESTONE_DEFINITION_OF_DONE.md) - DoD requirements

---

## Changelog

### v1.0 (M10.16, 2026-01-05)
- Initial cross-platform gate runner
- Fixed Windows `pnpm` spawn ENOENT issue
- Added self-check command
- Created runbook documentation
