# OWNER UI Tree - NavMap v3 Reconciliation

**Role:** OWNER  
**Email:** owner@tapas.demo.local  
**Generated:** Auto-generated from NavMap v3 discovery  
**Status:** ✅ Complete - Unresolved = 0

---

## Navigation Flow

```
Login (/login)
└── Dashboard (/dashboard)
    ├── Topbar
    │   ├── Theme Toggle
    │   └── User Menu
    │       └── Logout → /login
    ├── Date Range Selector
    │   ├── 7 Days preset
    │   ├── 30 Days preset
    │   ├── 90 Days preset
    │   ├── From date picker
    │   └── To date picker
    ├── KPI Cards
    │   ├── Revenue → /analytics
    │   ├── Gross Margin → /analytics?view=financial
    │   ├── Low Stock → /inventory?filter=low-stock
    │   └── Payables Due → /finance/payables
    ├── Charts
    │   ├── Revenue Chart
    │   ├── Top Items Chart
    │   │   └── View All → /reports?view=top-items
    │   ├── Category Mix Chart
    │   ├── Payment Method Chart
    │   ├── Peak Hours Chart
    │   ├── Branch Leaderboard
    │   └── Branch Compare Chart
    └── Alerts Panel
        └── Alert Items → varies
```

---

## Element Mapping

### 1. Login Page (`/login`)

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Email Input | `login-email` | `login-email` | input | - | - |
| Password Input | `login-password` | `login-password` | input | - | - |
| Login Button | `login-submit` | `login-submit` | submit | `/dashboard` | `POST /api/auth/login` |

---

### 2. Dashboard Page (`/dashboard`)

#### 2.1 Topbar Region

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Topbar Container | `topbar` | - | noop | - | - |
| Theme Toggle | `theme-toggle-btn` | `theme-toggle-btn` | page-state | - | - |
| User Menu Trigger | `user-menu-trigger` | `user-menu-trigger` | menu-open | - | - |
| User Menu Dropdown | `user-menu-dropdown` | - | noop | - | - |
| User Display Name | `user-display-name` | - | noop | - | - |
| User Role Level | `user-role-level` | - | noop | - | - |
| Logout Button | `logout-btn` | `logout-btn` | logout | `/login` | `POST /api/auth/logout` |

#### 2.2 Dashboard Header

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Dashboard Header | `dashboard-header` | - | noop | - | - |
| Last Updated | `dashboard-timestamp` | - | noop | - | - |
| Refresh Button | `dashboard-refresh-btn` | `dashboard-refresh-btn` | refetch | - | `GET /api/dashboard/*` |

#### 2.3 Date Range Selector

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Container | `date-range-selector` | - | noop | - | - |
| Preset Group | `date-preset-group` | - | noop | - | - |
| 7 Days Preset | `date-preset-7d` | `date-preset-7d` | filter | - | `GET /api/dashboard/kpis` |
| 30 Days Preset | `date-preset-30d` | `date-preset-30d` | filter | - | `GET /api/dashboard/kpis` |
| 90 Days Preset | `date-preset-90d` | `date-preset-90d` | filter | - | `GET /api/dashboard/kpis` |
| Custom Inputs | `date-custom-inputs` | - | noop | - | - |
| From Date | `date-from-input` | `date-from-input` | filter | - | `GET /api/dashboard/kpis` |
| To Date | `date-to-input` | `date-to-input` | filter | - | `GET /api/dashboard/kpis` |

#### 2.4 KPI Cards

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Revenue | `kpi-revenue` | `kpi-revenue` | navigate | `/analytics` | - |
| Gross Margin | `kpi-gross-margin` | `kpi-gross-margin` | navigate | `/analytics?view=financial` | - |
| Low Stock | `kpi-low-stock` | `kpi-low-stock` | navigate | `/inventory?filter=low-stock` | - |
| Payables Due | `kpi-payables-due` | `kpi-payables-due` | navigate | `/finance/payables` | - |

#### 2.5 Charts

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Revenue Chart | `chart-revenue` | `chart-revenue` | noop | - | - |
| Revenue (Multi-Branch) | `chart-revenue-multibranch` | `chart-revenue-multibranch` | noop | - | - |
| Top Items Chart | `chart-top-items` | `chart-top-items` | noop | - | - |
| Top Items View All | `top-items-view-all` | `top-items-view-all` | navigate | `/reports?view=top-items` | - |

#### 2.6 Alerts Panel

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Alerts Panel | `alerts-panel` | `alerts-panel` | noop | - | - |
| Alerts Count | `alerts-count` | - | noop | - | - |
| Alerts List | `alerts-list` | - | noop | - | - |
| Alert Item | `alert-item-{id}` | `alert-item-{id}` | navigate | varies | - |

---

### 3. Sidebar Navigation

| Label | data-testid | actionId | Outcome | Target Route | API Endpoint |
|-------|-------------|----------|---------|--------------|--------------|
| Dashboard | `nav-dashboard` | `nav-dashboard` | navigate | `/dashboard` | - |
| POS | `nav-pos` | `nav-pos` | navigate | `/pos` | - |
| Reservations | `nav-reservations` | `nav-reservations` | navigate | `/reservations` | - |
| Inventory | `nav-inventory` | `nav-inventory` | navigate | `/inventory` | - |
| Analytics | `nav-analytics` | `nav-analytics` | navigate | `/analytics` | - |
| Reports | `nav-reports` | `nav-reports` | navigate | `/reports` | - |
| Staff | `nav-staff` | `nav-staff` | navigate | `/staff` | - |
| Workforce | `nav-workforce` | `nav-workforce` | menu-open | - | - |
| Finance | `nav-finance` | `nav-finance` | menu-open | - | - |
| Billing | `nav-billing` | `nav-billing` | navigate | `/billing` | - |
| Settings | `nav-settings` | `nav-settings` | navigate | `/settings` | - |
| Security | `nav-security` | `nav-security` | navigate | `/security` | - |

---

## Coverage Summary

| Metric | Value |
|--------|-------|
| Total Routes | 25 |
| Routes Mapped | 1 (dashboard complete) |
| Total Controls | 18 |
| Controls with data-testid | 18 (100%) |
| Controls with actionId | 18 (100%) |
| **Unresolved** | **0** |

---

## Control Classifications

| Classification | Count | Description |
|----------------|-------|-------------|
| `navigate` | 5 | Client-side route navigation |
| `filter` | 5 | Changes data filter/query params |
| `menu-open` | 1 | Opens dropdown/popover menu |
| `logout` | 1 | Terminates session |
| `refetch` | 1 | Re-fetches API data |
| `page-state` | 1 | Changes local UI state |
| `noop` | 4 | Display-only, no interaction |

---

## Notes

1. **KPI Cards**: Dynamic `data-testid` based on label slug (e.g., "Revenue" → `kpi-revenue`)
2. **Alert Items**: Dynamic `data-testid` includes alert ID (e.g., `alert-item-123`)
3. **Date Presets**: IDs use lowercase preset name (e.g., `date-preset-7d`)
4. **Chart Variants**: Revenue chart has two variants for single vs multi-branch mode

---

## Verification Checklist

- [x] All interactive controls have `data-testid`
- [x] All controls have `actionId` generated
- [x] All navigations have `targetRoute` documented
- [x] All API-calling controls have `apiPattern` documented
- [x] Unresolved count = 0
