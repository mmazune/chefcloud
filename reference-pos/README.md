# Reference POS Repositories

**Purpose:** Read-only reference repositories for architecture pattern study and design inspiration.

**⚠️ CRITICAL LICENSE WARNING:** This folder contains open-source POS systems with varying licenses. **DO NOT COPY CODE** without careful license review. GPL-licensed repos require derivative works to also be GPL, which conflicts with proprietary software.

---

## Repositories

### 1. opensourcepos (MIT ✅)
- **URL:** https://github.com/opensourcepos/opensourcepos
- **Tech:** PHP, CodeIgniter, MySQL
- **License:** MIT
- **Why useful:** Mature inventory management, sales reporting, multi-location support
- **Safe to reference:** ✅ Yes (MIT is permissive)

### 2. nexopos (GPL-3.0 ⚠️)
- **URL:** https://github.com/Blair2004/NexoPOS
- **Tech:** Laravel, Vue.js, MySQL
- **License:** GPL-3.0
- **Why useful:** Modern Laravel architecture, modular design, multi-store support
- **Safe to copy code:** ❌ NO (GPL copyleft - reference only)

### 3. pos-awesome (GPL-3.0 ⚠️)
- **URL:** https://github.com/ucraft-com/POS-Awesome
- **Tech:** Frappe, ERPNext, Python
- **License:** GPL-3.0
- **Why useful:** ERP integration patterns, offline POS capabilities
- **Safe to copy code:** ❌ NO (GPL copyleft - reference only)

### 4. medusa-pos-starter (MIT ✅)
- **URL:** https://github.com/Agilo/medusa-pos-starter
- **Tech:** Medusa.js, Node.js, React
- **License:** MIT
- **Why useful:** Headless commerce POS integration, modern TS patterns
- **Safe to reference:** ✅ Yes (MIT is permissive)

### 5. medusa-pos-react (Unknown ⚠️)
- **URL:** https://github.com/pavlotsyhanok/medusa-pos-react
- **Tech:** React, Medusa.js
- **License:** UNKNOWN (no license file)
- **Why useful:** React POS UI patterns
- **Safe to copy code:** ❌ NO (assume proprietary/all rights reserved)

### 6. store-pos (Unknown ⚠️)
- **URL:** https://github.com/tngoman/Store-POS
- **Tech:** Laravel, Vue.js
- **License:** UNKNOWN (no license file)
- **Why useful:** Laravel POS patterns
- **Safe to copy code:** ❌ NO (assume proprietary/all rights reserved)

---

## GPL License Warning (IMPORTANT!)

**Repos with GPL-3.0:**
- nexopos
- pos-awesome

**What this means:**
- GPL is a **copyleft** license
- Any derivative work MUST also be GPL-3.0
- Copying GPL code into proprietary software violates the license
- **We CAN:** Study architecture, design patterns, API structure
- **We CANNOT:** Copy code, functions, or substantial implementations

**If you want to use GPL code:**
- We must release Nimbus POS as GPL-3.0 (making all source code public)
- OR we must obtain commercial licenses from the copyright holders
- OR we must rewrite functionality from scratch without copying

**Recommended approach:**
- Use GPL repos for **inspiration only**
- Understand their approach to problems (inventory FIFO, multi-tenant, etc.)
- Implement our own solutions independently

---

## Repos Without Licenses

**Repos with no license file:**
- medusa-pos-react
- store-pos

**What this means:**
- Under copyright law, **all rights reserved** by default
- No permission granted to use, copy, modify, or distribute
- Treat as proprietary/confidential code

**Recommended approach:**
- View code structure and UI patterns only
- Do not copy any code
- Reach out to authors if we want to use their work

---

## How to Use This Folder

### 1. Studying Architecture
```bash
# Open a repo in VS Code (read-only)
code reference-pos/opensourcepos

# Explore database schema
cat reference-pos/nexopos/database/migrations/*.php

# Study API routes
grep -r "Route::" reference-pos/nexopos/routes/
```

### 2. Comparing Approaches
Example: How do different POS handle inventory FIFO?
- opensourcepos: Check `application/models/Item.php`
- nexopos: Check `app/Services/InventoryService.php`
- Our approach: Compare with `services/api/src/inventory/consumption-calculator.ts`

### 3. UI Pattern Research
Example: How do they structure the POS cart UI?
- nexopos: `resources/ts/pages/dashboard/pos`
- medusa-pos-react: `src/components/pos`
- Our approach: Compare with `apps/web/src/pages/pos.tsx`

### 4. License Compliance
**Before referencing any code:**
1. Check `MANIFEST.json` for license type
2. If GPL → Study architecture only, do not copy
3. If MIT → OK to reference and adapt (with attribution)
4. If UNKNOWN → Do not copy

---

## Updating Repos

To pull latest changes for all repos:
```bash
# Run helper script (updates all repos)
./scripts/reference/clone-reference-pos.sh

# Or manually update one repo
cd reference-pos/opensourcepos
git fetch --all --prune
git pull --ff-only
```

**Note:** Repos are shallow clones (`--depth 1`) to save disk space. Full history not available.

---

## Metadata

See `MANIFEST.json` for:
- Current commit hashes
- Default branches
- License file locations
- License snippets (first 5 lines)

Example:
```bash
cat reference-pos/MANIFEST.json | jq '.repositories[] | select(.name=="opensourcepos")'
```

---

## Architecture Comparison Matrix

| Feature | opensourcepos | nexopos | pos-awesome | Nimbus POS |
|---------|--------------|---------|-------------|------------|
| **Tech Stack** | PHP/CodeIgniter | Laravel/Vue | Frappe/Python | NestJS/Next.js |
| **Database** | MySQL | MySQL | MariaDB | PostgreSQL |
| **Multi-tenant** | ❌ | ✅ | ✅ | ✅ |
| **Offline POS** | ❌ | ❌ | ✅ | ✅ (Service Worker) |
| **Inventory FIFO** | ✅ | ✅ | ✅ | ✅ (Recipe-based) |
| **KDS Screen** | ❌ | ❌ | ❌ | ✅ (SSE real-time) |
| **WebAuthn** | ❌ | ❌ | ❌ | ✅ |
| **Mobile App** | ❌ | ❌ | ❌ | ✅ (Expo) |
| **Desktop App** | ❌ | ❌ | ❌ | ✅ (Tauri) |

---

## Legal Disclaimer

This folder contains **third-party open-source software** for **reference purposes only**. Each repository retains its original copyright and license. Nimbus POS developers must comply with all applicable licenses when referencing or using code from these repositories.

**No warranty:** These repos are provided "as is" for study purposes. We make no claims about their functionality, security, or fitness for any purpose.

**License compliance:** It is the developer's responsibility to ensure compliance with all applicable licenses before using any code, patterns, or ideas from these repositories.

---

## Questions?

**Before copying any code:**
1. Check the repo's license in `MANIFEST.json`
2. If GPL → Ask lead developer for alternative approach
3. If MIT → OK to reference (with attribution in comments)
4. If UNKNOWN → Do not copy

**For architecture questions:**
- Use these repos to understand different approaches to problems
- Discuss findings with team before implementing
- Document our design decisions in completion reports

**For license questions:**
- Consult legal counsel if unsure about GPL implications
- When in doubt, implement from scratch

---

**Last Updated:** 2025-12-25  
**Maintained by:** Nimbus POS Engineering Team
