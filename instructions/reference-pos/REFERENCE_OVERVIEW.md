# Reference POS Repository Overview

**Purpose:** Strategic guide for studying 6 open-source POS repositories to inform Nimbus POS architecture without violating licenses.

**Date:** 2025-12-25  
**Documentation Set:** 6 comprehensive architecture MAPs + this overview

---

## 📚 Available Documentation

All MAP documents are in `/instructions/reference-pos/`:

| Repository | License | MAP Document | Focus Areas |
|------------|---------|--------------|-------------|
| **opensourcepos** | MIT ✅ | [opensourcepos_MAP.md](./opensourcepos_MAP.md) | Classic POS, Cash management, Receipt printing |
| **nexopos** | GPL-3.0 ⚠️ | [nexopos_MAP.md](./nexopos_MAP.md) | Service architecture, FIFO inventory, Multi-register |
| **pos-awesome** | GPL-3.0 ⚠️ | [pos-awesome_MAP.md](./pos-awesome_MAP.md) | ERP integration, Batch tracking, Loyalty/offers |
| **medusa-pos-starter** | MIT ✅ | [medusa-pos-starter_MAP.md](./medusa-pos-starter_MAP.md) | Mobile POS, Headless commerce, Setup wizard |
| **medusa-pos-react** | UNKNOWN ❌ | [medusa-pos-react_MAP.md](./medusa-pos-react_MAP.md) | B2B POS, Stripe Terminal, PWA |
| **store-pos** | UNKNOWN ❌ | [store-pos_MAP.md](./store-pos_MAP.md) | Desktop Electron, Offline-first, Embedded DB |

**Legend:**
- ✅ MIT = Safe to reference and adapt
- ⚠️ GPL-3.0 = Study architecture only, DO NOT copy code
- ❌ UNKNOWN = View structure only, assume proprietary

---

## 🎯 Strategic Repository Selection Guide

### When to Study Each Repository

#### **opensourcepos** (MIT, PHP/CodeIgniter)
**Study for:**
- ✅ Basic POS checkout flow (session cart → sale)
- ✅ Cash drawer reconciliation (cashup feature)
- ✅ Multi-payment handling (cash + card + giftcard)
- ✅ Simple RBAC (grant-based permissions)
- ✅ Receipt printing workflows
- ✅ Barcode generation patterns
- ✅ Tax jurisdiction logic

**Skip for:**
- ❌ Advanced accounting (no GL)
- ❌ FIFO costing (uses average cost)
- ❌ Multi-tenancy (single-tenant)
- ❌ Modern frontend (server-rendered views)
- ❌ Offline support (online-only)

**Best use case:** Understanding traditional POS fundamentals, learning PHP MVC patterns

---

#### **nexopos** (GPL-3.0, Laravel/Vue) ⚠️

**Study for (architecture only):**
- 🔍 Service layer organization (OrdersService, ProductService)
- 🔍 Event-driven architecture (OrderAfterCreatedEvent, etc.)
- 🔍 FIFO inventory via ProductHistory table
- 🔍 Multi-register cash management
- 🔍 Procurement workflow (PO approval → receiving)
- 🔍 Permission-based RBAC (string permissions)
- 🔍 UOM system (unit of measure variations)
- 🔍 Installment payments (layaway)

**Skip for:**
- ❌ Code implementation (GPL license prevents copying)
- ❌ Multi-tenancy (single-tenant)
- ❌ Offline support

**Best use case:** Studying modern Laravel patterns, understanding complex inventory flows

**⚠️ MANDATORY:** Follow clean-room protocol (see below)

---

#### **pos-awesome** (GPL-3.0, Frappe/ERPNext) ⚠️

**Study for (architecture only):**
- 🔍 ERP integration patterns (POS as ERP module)
- 🔍 Batch/lot tracking for perishables (FEFO logic)
- 🔍 Loyalty points & coupons system
- 🔍 Mobile payment integration (M-Pesa)
- 🔍 Weighted products (scale items)
- 🔍 Serial number tracking
- 🔍 Auto-apply offers & discounts
- 🔍 Shift opening/closing with variance
- 🔍 Enqueue pattern (background invoice submission)

**Skip for:**
- ❌ Code implementation (GPL license)
- ❌ Standalone POS (requires ERPNext)
- ❌ Custom framework (Frappe-specific)

**Best use case:** Learning batch tracking, loyalty systems, mobile payments

**⚠️ MANDATORY:** Follow clean-room protocol

---

#### **medusa-pos-starter** (MIT, Expo/React Native)

**Study for:**
- ✅ Mobile POS architecture (iOS/Android)
- ✅ Headless commerce integration (Medusa API)
- ✅ Setup wizard UX patterns
- ✅ Camera-based barcode scanning
- ✅ Draft order workflow
- ✅ AsyncStorage offline persistence
- ✅ React Query API state management
- ✅ Mobile-first navigation

**Skip for:**
- ❌ Desktop POS features
- ❌ Advanced inventory (backend-driven)
- ❌ Accounting (Medusa doesn't handle this)

**Best use case:** Building mobile POS apps, headless architecture, modern React Native patterns

---

#### **medusa-pos-react** (UNKNOWN, React/Vite PWA) ❌

**Study for (structure only):**
- 👁️ B2B customer group pricing patterns
- 👁️ Stripe Terminal integration approach
- 👁️ PWA deployment strategy
- 👁️ Modular React architecture
- 👁️ Pre-order/backorder workflows
- 👁️ Payment method storage patterns

**DO NOT:**
- ❌ Copy any code (assume proprietary)
- ❌ Use as implementation template

**Best use case:** Observing B2B POS patterns, Stripe Terminal architecture

---

#### **store-pos** (UNKNOWN, Electron/Express) ❌

**Study for (structure only):**
- 👁️ Desktop POS with embedded database (NeDB)
- 👁️ Offline-first architecture
- 👁️ Multi-PC network POS (shared files)
- 👁️ USB hardware integration
- 👁️ Local thermal printing
- 👁️ On-hold transaction patterns

**DO NOT:**
- ❌ Copy any code (assume proprietary)
- ❌ Use as implementation template

**Best use case:** Understanding offline desktop patterns, embedded database approach

---

## 📊 Repository Comparison Matrix

### Technical Stack

| Repo | Backend | Frontend | Database | Auth | Architecture |
|------|---------|----------|----------|------|--------------|
| **opensourcepos** | PHP/CI4 | jQuery/Bootstrap | MySQL | Sessions | MVC |
| **nexopos** | Laravel 12 | Vue 3 + Tailwind | MySQL/Postgres | Sanctum | Service Layer |
| **pos-awesome** | Python/Frappe | Vue + Vuetify | MariaDB | Frappe Auth | ERP Module |
| **medusa-pos-starter** | Medusa v2 API | React Native/Expo | Postgres (backend) | Medusa JWT | Headless |
| **medusa-pos-react** | Medusa v1 API | React/Vite | Postgres | Medusa JWT | Headless PWA |
| **store-pos** | Express | Electron/React | NeDB | Basic | Embedded Desktop |

### Feature Coverage

| Feature | opensourcepos | nexopos | pos-awesome | medusa-starter | medusa-react | store-pos |
|---------|---------------|---------|-------------|----------------|--------------|-----------|
| **Multi-payment** | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| **FIFO/FEFO** | ❌ Avg cost | ✅ History | ✅ Batch | ❌ Backend | ❌ Backend | ❌ |
| **Multi-tenancy** | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| **Offline mode** | ❌ | ❌ | ✅ IndexedDB | ✅ AsyncStorage | ✅ PWA cache | ✅ Embedded DB |
| **Cash drawer** | ✅ Cashup | ✅ Register | ✅ Shift | ❌ | ❌ | ✅ |
| **Accounting** | ❌ | ✅ Basic | ✅ ERP GL | ❌ | ❌ | ❌ |
| **Mobile app** | ❌ | ❌ | ❌ | ✅ iOS/Android | ✅ PWA | ❌ |
| **Desktop app** | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ Electron |
| **Modifiers** | ❌ Attrs | ❌ UOM | ❌ | ❌ | ❌ | ❌ |
| **Loyalty points** | ✅ Rewards | ❌ | ✅ Full system | ❌ | ❌ | ❌ |
| **Coupons** | ❌ | ✅ | ✅ Advanced | ✅ | ✅ | ❌ |
| **Purchase orders** | ✅ Receiving | ✅ Procurement | ✅ ERP | ❌ | ❌ | ❌ |

### License Implications

| Repo | License | Can Copy Code? | Can Adapt? | Can Reference? |
|------|---------|----------------|------------|----------------|
| **opensourcepos** | MIT | ✅ Yes | ✅ Yes | ✅ Yes |
| **nexopos** | GPL-3.0 | ❌ NO | ❌ NO | ✅ Architecture only |
| **pos-awesome** | GPL-3.0 | ❌ NO | ❌ NO | ✅ Architecture only |
| **medusa-pos-starter** | MIT | ✅ Yes | ✅ Yes | ✅ Yes |
| **medusa-pos-react** | UNKNOWN | ❌ Assume NO | ❌ Assume NO | 👁️ Structure only |
| **store-pos** | UNKNOWN | ❌ Assume NO | ❌ Assume NO | 👁️ Structure only |

---

## 🎓 Domain-Specific Recommendations

### **Authentication & Sessions**
**Best reference:** opensourcepos (MIT) + medusa-pos-starter (MIT)
- opensourcepos: Simple email/password with PHP sessions
- medusa-pos-starter: JWT token + AsyncStorage persistence
- **Nimbus approach:** JWT + WebAuthn + MSR badge (more advanced)

**Avoid:** nexopos Sanctum patterns (GPL), pos-awesome Frappe auth (GPL)

---

### **RBAC & Permissions**
**Best reference:** opensourcepos (MIT) grant-based, nexopos (GPL architecture study only)
- opensourcepos: Binary roles (admin/employee) + grant table
- nexopos: String permissions (e.g., `nexopos.create.orders`)
- **Nimbus approach:** Hierarchical levels (L1-L5) is simpler and effective

**Study GPL repos for:** Understanding granular permission patterns, but implement independently

---

### **Orders & Checkout**
**Best reference:** opensourcepos (MIT), medusa-pos-starter (MIT)
- opensourcepos: Session cart → sale on payment (simple)
- medusa-pos-starter: Draft order → complete (headless pattern)
- **Nimbus approach:** DB-persisted order (OPEN → CLOSED) for multi-device sync

**Study nexopos for:** Complex OrdersService architecture (but don't copy)

---

### **Payments & Multi-Payment**
**Best reference:** opensourcepos (MIT), medusa-pos-react (structure only)
- opensourcepos: Multi-payment via `sales_payments` table
- medusa-pos-react: Stripe Terminal integration patterns
- **Nimbus approach:** Similar multi-payment model + mobile payment support

---

### **Inventory FIFO**
**Best reference:** nexopos (GPL architecture study), pos-awesome (GPL architecture study)
- nexopos: ProductHistory table, FIFO via `created_at ASC`
- pos-awesome: Batch/lot tracking with FEFO (First Expired, First Out)
- **Nimbus approach:** StockBatch model with explicit batches + consumption calculator

**⚠️ Clean-room required** - Study concepts, implement independently

---

### **Cash Drawer & Shifts**
**Best reference:** opensourcepos (MIT), nexopos (GPL architecture)
- opensourcepos: Cashup model (expected vs actual reconciliation)
- nexopos: Register model with RegisterHistory
- **Nimbus approach:** Shift model + ShiftTransaction (explicit audit trail)

---

### **Purchase Orders & Receiving**
**Best reference:** opensourcepos (MIT), nexopos (GPL architecture)
- opensourcepos: Direct receiving (no PO workflow)
- nexopos: Procurement approval workflow (PENDING → APPROVED → DELIVERED)
- **Nimbus approach:** Full PO workflow (DRAFT → SUBMITTED → APPROVED → RECEIVED)

**Study GPL for:** Approval workflow patterns, implement independently

---

### **Loyalty & Offers**
**Best reference:** opensourcepos (MIT), pos-awesome (GPL architecture)
- opensourcepos: Customer rewards (points per dollar)
- pos-awesome: Advanced coupons, referral codes, auto-apply offers
- **Nimbus approach:** Can reference opensourcepos implementation, study pos-awesome patterns

**⚠️ pos-awesome is GPL** - Study offer auto-apply logic, implement independently

---

### **Mobile POS**
**Best reference:** medusa-pos-starter (MIT) ⭐
- React Native/Expo architecture
- Camera barcode scanning
- Offline AsyncStorage
- Setup wizard UX
- **Nimbus approach:** Can directly reference and adapt (MIT license)

---

### **Desktop POS & Offline**
**Best reference:** store-pos (structure only), opensourcepos printing (MIT)
- store-pos: Embedded NeDB database, Electron patterns
- opensourcepos: Receipt templates, barcode generation
- **Nimbus approach:** Tauri desktop app + SQLite queue (different stack, but learn patterns)

**⚠️ store-pos is UNKNOWN** - View structure only, don't copy

---

### **Printing (Receipts & Kitchen)**
**Best reference:** opensourcepos (MIT), store-pos (structure only)
- opensourcepos: ESC/POS templates, dompdf receipts
- store-pos: Electron native printing
- **Nimbus approach:** Tauri native printing + ESC/POS package

**Safe to adapt:** opensourcepos receipt templates (MIT)

---

### **B2B Features (Customer Groups, Price Lists)**
**Best reference:** medusa-pos-react (structure only)
- Customer group pricing patterns
- Pre-order/backorder workflows
- **Nimbus approach:** Study patterns, implement from scratch

**⚠️ UNKNOWN license** - Don't copy code

---

## 🛡️ Clean-Room Implementation Workflow

**For GPL-licensed repos (nexopos, pos-awesome):**

### Phase 1: Study (Allowed)
1. Read the architecture MAP document
2. Review file structure (paths, organization)
3. Understand the **concept** (e.g., "FIFO via history table")
4. Document the **approach** in your own words
5. Note **trade-offs** and design decisions

### Phase 2: Isolation (Critical)
6. **Close all GPL repo files** (don't keep tabs open)
7. **Do NOT reference GPL code during implementation**
8. Clear your mind of implementation details

### Phase 3: Design (Independent)
9. Design Nimbus solution **from scratch**
10. Use Nimbus patterns and conventions
11. Solve the problem independently
12. Document why your approach differs

### Phase 4: Implementation (Original)
13. Write code without looking at GPL repos
14. Use TypeScript/NestJS/React (different stack anyway)
15. Follow Nimbus architecture patterns
16. Test independently

### Phase 5: Review (Optional)
17. **After implementation complete**, optionally compare approaches
18. Note architectural differences
19. Refine if needed (but still independently)

---

## ⚠️ License Risk Mitigation

### Safe Practices

✅ **DO:**
- Study architecture patterns from all repos
- Read MAP documents thoroughly
- Understand concepts and trade-offs
- Reference MIT-licensed code (opensourcepos, medusa-pos-starter)
- Adapt MIT-licensed templates and snippets
- Document learnings in completion reports
- Implement features from scratch after study

❌ **DO NOT:**
- Copy code from GPL repos (nexopos, pos-awesome)
- Adapt algorithms directly from GPL repos
- Use GPL code as implementation template
- Copy code from UNKNOWN repos (medusa-pos-react, store-pos)
- Keep GPL/UNKNOWN repo files open during implementation

### License Checklist (Before Using Reference)

**Before studying a repository, ask:**

1. **Is it MIT?** → ✅ Safe to reference and adapt
2. **Is it GPL?** → ⚠️ Architecture study only, clean-room required
3. **Is license unknown?** → ❌ Assume proprietary, structure view only
4. **Am I copying code?** → ❌ Stop if GPL/UNKNOWN
5. **Am I studying concepts?** → ✅ Allowed for all repos
6. **Did I close the files before implementing?** → Must be YES for GPL/UNKNOWN

---

## 📈 Strength/Weakness Analysis

### **opensourcepos** (MIT)

**Strengths:**
- ✅ MIT license (safe to reference)
- ✅ Simple, understandable codebase
- ✅ Production-tested (10+ years)
- ✅ Good cash management (cashup)
- ✅ Multi-payment handling
- ✅ Receipt printing templates

**Weaknesses:**
- ❌ No FIFO (average cost only)
- ❌ Single-tenant only
- ❌ No offline support
- ❌ Server-rendered UI (not modern)
- ❌ No accounting (basic expenses only)

**Best for:** Learning POS fundamentals, referencing receipt templates, understanding cash reconciliation

---

### **nexopos** (GPL-3.0)

**Strengths:**
- ✅ Modern Laravel patterns
- ✅ Service layer architecture
- ✅ Event-driven design
- ✅ FIFO via ProductHistory
- ✅ Procurement workflows
- ✅ Multi-register management

**Weaknesses:**
- ❌ GPL license (can't copy code)
- ❌ Single-tenant
- ❌ No offline mode
- ❌ 114KB OrdersService (too monolithic)
- ❌ No true multi-tenancy

**Best for:** Studying modern Laravel architecture, understanding complex inventory patterns (architecture only)

---

### **pos-awesome** (GPL-3.0)

**Strengths:**
- ✅ ERP integration (full business suite)
- ✅ Batch/lot tracking (FEFO)
- ✅ Loyalty & coupon system
- ✅ Mobile payments (M-Pesa)
- ✅ Serial number tracking
- ✅ Offline IndexedDB support

**Weaknesses:**
- ❌ GPL license (can't copy code)
- ❌ Requires ERPNext (not standalone)
- ❌ Frappe framework dependency
- ❌ Complex setup
- ❌ Single-tenant

**Best for:** Understanding batch tracking, loyalty systems, ERP integration patterns (architecture only)

---

### **medusa-pos-starter** (MIT)

**Strengths:**
- ✅ MIT license (safe to reference)
- ✅ Mobile-first (iOS/Android)
- ✅ Modern React Native patterns
- ✅ Headless architecture
- ✅ Setup wizard UX
- ✅ AsyncStorage offline persistence
- ✅ Clean code structure

**Weaknesses:**
- ❌ Medusa backend dependency
- ❌ Basic inventory (backend-driven)
- ❌ No cash management
- ❌ No accounting
- ❌ Limited customization (starter template)

**Best for:** Building mobile POS, headless commerce patterns, React Native architecture

---

### **medusa-pos-react** (UNKNOWN)

**Strengths:**
- ✅ B2B customer group pricing
- ✅ Stripe Terminal integration
- ✅ PWA deployment
- ✅ Modern React/Vite stack
- ✅ Modular architecture

**Weaknesses:**
- ❌ Unknown license (assume proprietary)
- ❌ No backend included
- ❌ Limited documentation
- ❌ Incomplete features (WIP)

**Best for:** Observing B2B patterns, Stripe Terminal approach (structure only, don't copy)

---

### **store-pos** (UNKNOWN)

**Strengths:**
- ✅ Offline-first (embedded NeDB)
- ✅ Desktop Electron app
- ✅ Multi-PC network sync
- ✅ USB hardware integration
- ✅ Local thermal printing

**Weaknesses:**
- ❌ Unknown license (assume proprietary)
- ❌ Embedded DB limits scalability
- ❌ No cloud sync
- ❌ Basic RBAC
- ❌ No inventory FIFO

**Best for:** Understanding offline desktop patterns, embedded database approach (structure only)

---

## 🚀 Recommended Study Path for Nimbus Development

### **Foundation (Week 1)**
1. Read all 6 MAP documents thoroughly
2. Understand each repo's strengths/weaknesses
3. Map domains to Nimbus requirements

### **Safe Reference Study (Week 2)**
4. Deep dive: **opensourcepos** (MIT)
   - Cash management patterns
   - Receipt templates
   - Multi-payment flow
   - Tax calculations
5. Deep dive: **medusa-pos-starter** (MIT)
   - Mobile architecture
   - Setup wizard UX
   - Headless integration
   - Offline persistence

### **Architecture Study (Week 3-4)**
6. Study (architecture only): **nexopos** (GPL)
   - Service layer organization
   - Event-driven patterns
   - FIFO via history table
   - Register management
7. Study (architecture only): **pos-awesome** (GPL)
   - Batch tracking approach
   - Loyalty system design
   - Auto-apply offers logic
   - Shift variance tracking

### **Observation (Week 5)**
8. Observe (structure only): **medusa-pos-react** (UNKNOWN)
   - B2B pricing patterns
   - Stripe Terminal approach
9. Observe (structure only): **store-pos** (UNKNOWN)
   - Embedded DB patterns
   - Desktop offline architecture

### **Implementation (Week 6+)**
10. Design Nimbus features independently
11. Implement from scratch (clean-room for GPL/UNKNOWN)
12. Compare approaches after completion
13. Document architectural decisions

---

## 📝 Documentation Usage Guidelines

### **For Engineering Team:**

**When starting a new feature:**
1. Check this REFERENCE_OVERVIEW.md for domain recommendations
2. Read the relevant MAP document(s)
3. Note license restrictions
4. Follow clean-room workflow if GPL/UNKNOWN
5. Document learnings in completion report

**When stuck on architecture:**
1. Review similar feature in MIT repos first (opensourcepos, medusa-pos-starter)
2. If needed, study GPL repo architecture (nexopos, pos-awesome)
3. Never copy GPL code - implement independently
4. Compare approaches after your implementation

**When reviewing code:**
1. Ensure no GPL/UNKNOWN code copied
2. Verify clean-room protocol followed
3. Check architectural differences documented

---

## 🎯 Strategic Advantages for Nimbus

**By studying these 6 repos, Nimbus gains:**

1. **Best practices** from 10+ years of production POS development
2. **Architectural patterns** from multiple tech stacks (PHP, Laravel, Python, React)
3. **Domain knowledge** across retail, restaurant, B2B, mobile, desktop
4. **Trade-off understanding** (e.g., FIFO approaches, offline strategies)
5. **Feature inspiration** (loyalty, coupons, mobile payments)
6. **UX patterns** (setup wizards, cash reconciliation, receipt printing)

**Without legal risk:**
- MIT repos (2): Safe to reference and adapt
- GPL repos (2): Study architecture, implement independently
- UNKNOWN repos (2): Observe structure, assume proprietary

---

## 🔗 Quick Links

**MAP Documents:**
- [opensourcepos_MAP.md](./opensourcepos_MAP.md) - MIT, Classic PHP POS
- [nexopos_MAP.md](./nexopos_MAP.md) - GPL-3.0, Modern Laravel POS
- [pos-awesome_MAP.md](./pos-awesome_MAP.md) - GPL-3.0, ERP-integrated POS
- [medusa-pos-starter_MAP.md](./medusa-pos-starter_MAP.md) - MIT, Mobile React Native POS
- [medusa-pos-react_MAP.md](./medusa-pos-react_MAP.md) - UNKNOWN, B2B PWA POS
- [store-pos_MAP.md](./store-pos_MAP.md) - UNKNOWN, Desktop Electron POS

**Other Reference Docs:**
- [REFERENCE_SIDE_BY_SIDE_INDEX.md](../REFERENCE_SIDE_BY_SIDE_INDEX.md) - Domain-by-domain comparison
- [REFERENCE_REPO_FILE_MAPS.md](../REFERENCE_REPO_FILE_MAPS.md) - File structure index
- [../reference-pos/MANIFEST.json](../../reference-pos/MANIFEST.json) - License metadata
- [../reference-pos/README.md](../../reference-pos/README.md) - Usage guidelines

---

**Last Updated:** 2025-12-25  
**Status:** ✅ Complete - All 6 repos documented  
**Next Steps:** Begin feature-specific deep dives following the study path above
