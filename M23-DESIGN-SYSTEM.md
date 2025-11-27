# M23 – Design System Documentation

**Date:** November 22, 2025  
**Status:** ✅ Complete  
**Location:** `apps/web/src/components/ui/`

---

## Overview

ChefCloud Web Backoffice uses a custom design system built on Tailwind CSS with shadcn/ui-inspired components. The design system emphasizes:

- **Consistency**: Reusable components with predictable behavior
- **Accessibility**: WCAG 2.1 AA compliant colors and contrast
- **Theme Support**: Light/dark mode with ChefCloud brand colors
- **Type Safety**: Full TypeScript support

---

## Color Palette

### Brand Colors

```typescript
// packages/ui/src/index.ts
export const colors = {
  primaryNavy: '#00033D',    // Main brand color (dark navy)
  chefBlue: '#0033FF',       // Interactive elements (bright blue)
  lavenderAccent: '#977DFF', // Accents, highlights (purple)
  softGray: '#EAEDF3',       // Backgrounds, surfaces (light gray)
  ink: '#030812',            // Text (very dark blue)
  white: '#FFFFFF',          // White
};
```

### Tailwind Config Extensions

The ChefCloud palette is integrated into Tailwind's theme:

```javascript
// tailwind.config.js
theme: {
  extend: {
    colors: {
      chefcloud: {
        navy: '#00033D',
        blue: '#0033FF',
        lavender: '#977DFF',
        gray: '#EAEDF3',
        ink: '#030812',
      },
    },
  },
}
```

**Usage:**
```tsx
<div className="bg-chefcloud-navy text-white">...</div>
<button className="bg-chefcloud-blue hover:bg-chefcloud-navy">...</button>
```

### Semantic Colors (Light Mode)

```css
--primary: hsl(239 100% 25%)      /* ChefCloud Navy */
--secondary: hsl(240 4.8% 95.9%)  /* Light gray backgrounds */
--accent: hsl(240 4.8% 95.9%)     /* Hover states */
--destructive: hsl(0 84.2% 60.2%) /* Error/danger */
--muted: hsl(240 4.8% 95.9%)      /* Disabled states */
--ring: hsl(239 100% 50%)         /* ChefCloud Blue focus rings */
```

### Dark Mode Colors

```css
--primary: hsl(239 100% 50%)      /* ChefCloud Blue (lighter in dark) */
--ring: hsl(262 83% 58%)          /* Lavender focus rings */
--background: hsl(240 10% 3.9%)   /* Very dark background */
```

---

## Typography

### Font Stack

```css
font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
```

### Text Sizes (Tailwind)

- `text-xs`: 0.75rem (12px) - Small labels, captions
- `text-sm`: 0.875rem (14px) - Body text, table cells
- `text-base`: 1rem (16px) - Default body text
- `text-lg`: 1.125rem (18px) - Subheadings
- `text-xl`: 1.25rem (20px) - Card titles
- `text-2xl`: 1.5rem (24px) - Section headings
- `text-3xl`: 1.875rem (30px) - Page titles

---

## Core Components

### 1. Button

**Location:** `components/ui/button.tsx`

**Variants:**
- `default`: Primary action (ChefCloud blue background)
- `destructive`: Danger actions (red)
- `outline`: Secondary actions (border only)
- `secondary`: Subtle actions (gray background)
- `ghost`: Minimal actions (no background)
- `link`: Text link style

**Sizes:**
- `default`: h-10 px-4 py-2
- `sm`: h-9 px-3
- `lg`: h-11 px-8
- `icon`: h-10 w-10 (square for icons)

**Usage:**
```tsx
import { Button } from '@/components/ui/button';

<Button variant="default" size="default">Save Changes</Button>
<Button variant="destructive">Delete</Button>
<Button variant="outline" size="sm">Cancel</Button>
<Button variant="ghost" size="icon"><Icon /></Button>
```

---

### 2. Card

**Location:** `components/ui/card.tsx`

**Sub-components:**
- `Card`: Container with border and shadow
- `CardHeader`: Header section with padding
- `CardTitle`: Bold title text
- `CardDescription`: Muted description text
- `CardContent`: Main content area
- `CardFooter`: Footer with actions

**Usage:**
```tsx
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

<Card>
  <CardHeader>
    <CardTitle>User Stats</CardTitle>
    <CardDescription>Last 30 days</CardDescription>
  </CardHeader>
  <CardContent>
    <p>Content here...</p>
  </CardContent>
</Card>
```

---

### 3. Badge

**Location:** `components/ui/badge.tsx`

**Variants:**
- `default`: Primary badge (blue)
- `secondary`: Gray badge
- `destructive`: Red badge (errors)
- `outline`: Border only
- `success`: Green badge (positive states)
- `warning`: Yellow badge (warnings)
- `info`: Blue badge (informational)

**Usage:**
```tsx
import { Badge } from '@/components/ui/badge';

<Badge variant="success">ACTIVE</Badge>
<Badge variant="warning">LOW_STOCK</Badge>
<Badge variant="destructive">CRITICAL</Badge>
<Badge>PENDING</Badge>
```

---

### 4. Input

**Location:** `components/ui/input.tsx`

**Features:**
- Focus ring with ChefCloud blue
- Disabled state styling
- Full width by default
- Supports all HTML input types

**Usage:**
```tsx
import { Input } from '@/components/ui/input';

<Input type="email" placeholder="you@example.com" />
<Input type="password" placeholder="••••••••" disabled />
<Input type="number" min={0} max={100} />
```

---

### 5. StatCard (Custom)

**Location:** `components/ui/stat-card.tsx`

**Purpose:** Display key metrics with trend indicators

**Props:**
- `label`: string - Metric label
- `value`: string | number - Main value
- `delta?`: number - Percentage change (optional)
- `trend?`: 'up' | 'down' | 'neutral' - Trend indicator (auto-detected from delta)
- `icon?`: ReactNode - Icon to display
- `className?`: string - Additional Tailwind classes

**Features:**
- Automatically shows trend arrows based on delta
- Green for positive trends, red for negative
- Large, bold value text
- Muted label text

**Usage:**
```tsx
import { StatCard } from '@/components/ui/stat-card';
import { DollarSign } from 'lucide-react';

<StatCard
  label="Total Sales"
  value="UGX 15,750,000"
  delta={10.5}
  icon={<DollarSign className="h-4 w-4" />}
/>
```

---

### 6. DataTable (Custom)

**Location:** `components/ui/data-table.tsx`

**Purpose:** Display tabular data with consistent styling

**Props:**
- `data`: T[] - Array of objects to display
- `columns`: Column<T>[] - Column definitions
- `className?`: string - Additional classes
- `emptyMessage?`: string - Message when no data

**Column Definition:**
```typescript
interface Column<T> {
  header: string;                          // Column header text
  accessor: keyof T | ((row: T) => ReactNode); // Data accessor or render function
  className?: string;                      // Column-specific classes
}
```

**Usage:**
```tsx
import { DataTable } from '@/components/ui/data-table';

const columns = [
  { header: 'Name', accessor: 'name' },
  { header: 'Email', accessor: 'email' },
  {
    header: 'Status',
    accessor: (row) => <Badge>{row.status}</Badge>,
  },
];

<DataTable data={users} columns={columns} />
```

---

## Layout Components

### 1. AppShell

**Location:** `components/layout/AppShell.tsx`

**Purpose:** Main authenticated layout wrapper

**Features:**
- Wraps content in ProtectedRoute (redirects if not authenticated)
- Renders Sidebar (fixed left)
- Renders Topbar (sticky top)
- Main content area with max-width container
- Responsive padding and overflow handling

**Usage:**
```tsx
import { AppShell } from '@/components/layout/AppShell';

export default function MyPage() {
  return (
    <AppShell>
      <h1>Page Content</h1>
    </AppShell>
  );
}
```

---

### 2. Sidebar

**Location:** `components/layout/Sidebar.tsx`

**Features:**
- Fixed left sidebar (w-64)
- Logo and branding at top
- Navigation items with active state highlighting
- Active route detection (exact match or starts with)
- Version info at bottom

**Navigation Items:**
- Dashboard, Staff, Inventory, Finance
- Service Providers, Reservations, Feedback, Settings

**Active State:** Primary background with white text

---

### 3. Topbar

**Location:** `components/layout/Topbar.tsx`

**Features:**
- Sticky header (z-30)
- Displays current branch/org info
- Theme toggle (light/dark mode)
- User menu with avatar, name, role, and logout

**User Menu:**
- Shows user's displayName and roleLevel
- Dropdown with user info and logout button
- Backdrop click to close

---

### 4. PageHeader

**Location:** `components/layout/PageHeader.tsx`

**Purpose:** Consistent page title and subtitle

**Props:**
- `title`: string - Page title (h1)
- `subtitle?`: string - Optional subtitle (muted text)
- `actions?`: ReactNode - Optional action buttons (right-aligned)
- `className?`: string - Additional classes

**Usage:**
```tsx
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/button';

<PageHeader
  title="Staff Management"
  subtitle="View staff performance metrics"
  actions={<Button>Add Staff</Button>}
/>
```

---

## Theme System

### Light/Dark Mode Toggle

**Implementation:** `components/layout/Topbar.tsx`

**How it Works:**
1. Toggle button adds/removes `dark` class on `<html>` element
2. CSS variables update based on `.dark` class
3. localStorage can persist preference (future enhancement)

**CSS Variables:**
- Defined in `styles/globals.css`
- `:root` for light mode
- `.dark` for dark mode

**Applying Theme Colors:**
```tsx
// Use semantic color names (auto-adapts to theme)
<div className="bg-background text-foreground">
  <div className="bg-card text-card-foreground">
    <Button>Primary button adapts automatically</Button>
  </div>
</div>
```

---

## Utility Functions

**Location:** `lib/utils.ts`

### `cn(...inputs)`
Merge Tailwind classes with conflict resolution

```tsx
import { cn } from '@/lib/utils';

<div className={cn('bg-blue-500', isActive && 'bg-green-500')} />
```

### `formatCurrency(amount)`
Format numbers as UGX currency

```tsx
formatCurrency(15750000) // "UGX 15,750,000"
```

### `formatDate(date)` & `formatDateTime(date)`
Format dates for Uganda locale

```tsx
formatDate('2025-11-22') // "Nov 22, 2025"
formatDateTime('2025-11-22T14:30:00Z') // "Nov 22, 2025, 02:30 PM"
```

### `calculatePercentageChange(current, previous)`
Calculate percentage change

```tsx
calculatePercentageChange(110, 100) // 10
```

### `formatPercentage(value, decimals?)`
Format as percentage

```tsx
formatPercentage(10.5) // "10.5%"
formatPercentage(10.567, 2) // "10.57%"
```

### `truncate(text, maxLength)`
Truncate text with ellipsis

```tsx
truncate("Long text here", 10) // "Long text..."
```

---

## Icons

**Library:** `lucide-react`

**Common Icons:**
- `LayoutDashboard`, `Users`, `Package`, `DollarSign`
- `Wrench`, `Calendar`, `MessageSquare`, `Settings`
- `TrendingUp`, `TrendingDown`, `Minus`
- `Star`, `ThumbsUp`, `ThumbsDown`
- `Moon`, `Sun`, `User`, `LogOut`, `ChevronDown`

**Usage:**
```tsx
import { LayoutDashboard, Users, TrendingUp } from 'lucide-react';

<LayoutDashboard className="h-5 w-5" />
<Users className="h-4 w-4 text-blue-500" />
<TrendingUp className="h-6 w-6 text-green-500" />
```

---

## Responsive Design

### Breakpoints (Tailwind defaults)

- `sm`: 640px
- `md`: 768px
- `lg`: 1024px
- `xl`: 1280px
- `2xl`: 1536px

### Grid Examples

```tsx
{/* 1 column on mobile, 2 on tablet, 3 on desktop */}
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
  <StatCard label="Metric 1" value="100" />
  <StatCard label="Metric 2" value="200" />
  <StatCard label="Metric 3" value="300" />
</div>

{/* 4 columns on desktop */}
<div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
  ...
</div>
```

---

## Best Practices

### 1. Use Semantic Colors

❌ **Don't:**
```tsx
<div className="bg-blue-500 text-white">...</div>
```

✅ **Do:**
```tsx
<div className="bg-primary text-primary-foreground">...</div>
```

### 2. Consistent Spacing

Use Tailwind's spacing scale:
- `gap-4` (1rem) for grid/flex gaps
- `space-y-4` for vertical stacking
- `p-6` (1.5rem) for card padding
- `mb-8` (2rem) for section margins

### 3. Loading States

```tsx
{isLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
{!isLoading && data && <DataTable data={data} columns={columns} />}
```

### 4. Error States

```tsx
{error && (
  <div className="rounded-md bg-red-50 p-3 text-sm text-red-600">
    {error.message}
  </div>
)}
```

### 5. Empty States

```tsx
<DataTable
  data={items}
  columns={columns}
  emptyMessage="No items found. Add your first item to get started."
/>
```

---

## Component Composition Example

```tsx
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/ui/data-table';

export default function MyPage() {
  return (
    <AppShell>
      <PageHeader
        title="My Page"
        subtitle="Subtitle here"
        actions={<Button>Add New</Button>}
      />

      <Card>
        <CardHeader>
          <CardTitle>Section Title</CardTitle>
        </CardHeader>
        <CardContent>
          <DataTable
            data={items}
            columns={[
              { header: 'Name', accessor: 'name' },
              {
                header: 'Status',
                accessor: (row) => <Badge variant="success">{row.status}</Badge>,
              },
            ]}
          />
        </CardContent>
      </Card>
    </AppShell>
  );
}
```

---

## Future Enhancements

1. **Additional Components:**
   - Toast notifications (using @radix-ui/react-toast)
   - Modal dialogs (using @radix-ui/react-dialog)
   - Dropdown menus (using @radix-ui/react-dropdown-menu)
   - Form components (Select, Checkbox, Radio, Textarea)
   - Tabs component
   - Accordion component

2. **Advanced Features:**
   - Skeleton loaders for better loading UX
   - Pagination component for DataTable
   - Search/filter inputs with debouncing
   - Date picker component
   - Chart components (recharts integration)

3. **Accessibility:**
   - Keyboard navigation improvements
   - Screen reader announcements
   - Focus trap for modals
   - ARIA labels for all interactive elements

4. **Performance:**
   - Lazy load components
   - Virtual scrolling for large tables
   - Image optimization with next/image

---

**Last Updated:** November 22, 2025  
**Version:** 0.1.0 (M23 MVP)
