# tremor MAP

> **Repository:** https://github.com/tremorlabs/tremor  
> **License:** ✅ Apache-2.0 (adaptation allowed with attribution)  
> **Domain:** UI Systems / Dashboard Components  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

React component library for dashboards. Best reference for:
- KPI cards and metrics display
- Chart components (bar, line, area, donut)
- Data table patterns
- Dashboard layout patterns
- Tailwind CSS component design
- Accessibility in charts

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | React |
| Styling | Tailwind CSS |
| Charts | Recharts |
| Build | Vite |
| Testing | Vitest |
| Docs | Storybook |

---

## (iii) High-Level Directory Map

```
tremor/
├── src/
│   ├── components/
│   │   ├── chart-elements/   # Chart components
│   │   ├── icon-elements/    # Icons
│   │   ├── input-elements/   # Form inputs
│   │   ├── layout-elements/  # Layout components
│   │   ├── list-elements/    # Lists
│   │   ├── text-elements/    # Typography
│   │   └── vis-elements/     # Visualization
│   ├── hooks/                # Custom hooks
│   └── utils/                # Utilities
└── stories/                  # Storybook stories
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Bar Chart | `src/components/chart-elements/BarChart/` |
| Line Chart | `src/components/chart-elements/LineChart/` |
| Area Chart | `src/components/chart-elements/AreaChart/` |
| Donut Chart | `src/components/chart-elements/DonutChart/` |
| KPI Card | `src/components/vis-elements/Card/` |
| Metric | `src/components/vis-elements/Metric/` |
| Table | `src/components/list-elements/Table/` |
| Badge/Delta | `src/components/vis-elements/` |

---

## (v) Key Flows

### Chart Data Flow
- Accept data as array of objects
- Map data keys to chart dimensions
- Handle loading/empty states
- Responsive container sizing

### Component Composition
- Cards contain Metrics, Charts
- Flex/Grid layouts for arrangement
- Consistent spacing via Tailwind

### Theming
- Color palette configurable
- Dark mode support
- Consistent visual language

---

## (vi) What We Can Adapt

**✅ Apache-2.0 = Adaptation allowed with attribution**

- Component API patterns
- Chart data format conventions
- Tailwind styling approach
- Responsive patterns
- Accessibility implementations

---

## (vii) What Nimbus Should Learn

1. **KPI card pattern** — Title, value, trend, sparkline

2. **Delta/change indicators** — Up/down with color coding

3. **Chart container** — Responsive sizing, loading states

4. **Data format convention** — `[{ date, value }]` patterns

5. **Category colors** — Consistent palette across charts

6. **Legend placement** — Chart legend positioning

7. **Tooltip design** — Hover information display

8. **Empty states** — No data visualization

9. **Loading skeletons** — Chart placeholder animations

10. **Table sorting/pagination** — Interactive data tables

11. **Badge system** — Status indicators

12. **Progress bars** — Completion indicators
