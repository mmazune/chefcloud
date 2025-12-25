# Open-Source POS Comparison Matrix (Initial)

_Last updated: 2025-12-25_

This is an initial, pragmatic comparison of candidate open-source POS projects against Nimbus POS goals. It is intended to guide which repos we study for patterns and parity, not to mandate copying.

> Important: For any repo under GPL/AGPL, do not copy code verbatim into Nimbus POS unless we intentionally adopt a compatible open-source license.

---

## 1. Summary Table

| Project | Domain Fit | Platforms | Stack | License | Notable Strengths | Key Gaps vs Nimbus |
|---|---|---|---|---|---|---|
| Open Source POS (OSPOS) | Retail/general POS | Web | PHP (CodeIgniter) + MySQL | Has LICENSE file (confirm type) | Mature POS flows, inventory basics, long history | Not restaurant-first (recipes/KDS limited), stack mismatch |
| NexoPOS | Retail/general POS + modules | Web | Laravel + Vue + Tailwind | GPL-3.0 | Rich features, modular ecosystem, good UI patterns | GPL copy risk; restaurant specifics depend on modules |
| ERPNext POS (built-in) | ERP + POS | Web (PWA-like) | Frappe (Python + JS) | GPL (ERPNext) | ERP-grade accounting + inventory; offline support in POS docs | Stack mismatch; customization complexity |
| POS Awesome (ERPNext addon) | POS frontend for ERPNext | Web (Vue) | Vue + Vuetify on ERPNext | GPL-3.0 | Modern POS UI; ERPNext integration | GPL copy risk; depends on ERPNext |
| Medusa POS React | Retail/B2B POS | PWA (mobile/tablet/desktop) | React + Capacitor (Vite) | (license not confirmed via tool) | Modern PWA patterns, device API approach | Backend is Medusa (commerce) not restaurant; license needs verification |
| Store-POS | Retail/basic POS | Desktop (Electron) | Node/Express/Electron | (license not visible in tool) | Desktop printing, barcode flows | Basic inventory; not restaurant-first |

---

## 2. “What to Borrow” Recommendations

### 2.1 Best UX reference (PWA + device integration)
- **Medusa POS React**: borrow ideas for PWA + device APIs and “kiosk-like” flow (even if backend differs).

### 2.2 Best enterprise accounting reference (concept-level)
- **ERPNext POS/ERPNext accounting**: borrow report shapes and accounting workflows (GL/AP/AR), but re-implement in our stack.

### 2.3 Best modular web POS reference
- **NexoPOS**: borrow “module boundary” and dashboard patterns, but treat GPL constraints as a hard legal boundary.

### 2.4 Printing + desktop operational reference
- **Store-POS** (and similar Electron/Tauri repos): borrow print/installer patterns conceptually.

---

## 3. Next Step (Deep Dive Procedure)

For each selected repo:
1. Capture: architecture, data model, state machines, reports.
2. Build a “concept map” for 3–5 target features (split bills, refunds, stock receiving, end-of-day, etc.).
3. Map to Nimbus modules and implement with tests.
4. Record parity and gaps into the PRD backlog.

