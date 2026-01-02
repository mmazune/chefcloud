# TastyIgniter MAP

> **Repository:** https://github.com/tastyigniter/TastyIgniter  
> **License:** ✅ MIT (adaptation allowed with attribution)  
> **Domain:** Restaurant Management / Reservations  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Restaurant management platform. Best reference for:
- Table reservations and booking
- Menu and category management
- Order management (dine-in, takeout, delivery)
- Floor plan / table layouts
- Kitchen display integration
- Customer management
- Restaurant-specific workflows

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | PHP / Laravel |
| Database | MySQL |
| Frontend | Blade templates / Vue.js |
| Admin | Livewire components |
| Extensions | Modular plugin system |

---

## (iii) High-Level Directory Map

```
TastyIgniter/
├── app/
│   ├── Admin/           # Admin panel
│   │   ├── Controllers/
│   │   ├── Models/
│   │   └── Widgets/
│   ├── Main/            # Customer-facing
│   └── System/          # Core system
├── extensions/          # Plugin directory
├── config/              # Configuration
├── database/
│   └── migrations/
└── lang/                # Localization
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Menu items | `app/Admin/Models/Menu.php` |
| Categories | `app/Admin/Models/Category.php` |
| Tables | `app/Admin/Models/Table.php` |
| Reservations | `app/Admin/Models/Reservation.php` |
| Orders | `app/Admin/Models/Order.php` |
| Customers | `app/Admin/Models/Customer.php` |
| Locations | `app/Admin/Models/Location.php` |
| Order controller | `app/Admin/Controllers/Orders.php` |

---

## (v) Key Flows

### Reservation Flow
- Customer selects date/time/party size
- System checks table availability
- Creates `Reservation` with status
- Sends confirmation notification
- Staff can confirm/cancel/seat

### Menu Management Flow
- `Category` → `Menu` (items)
- Menu has options/modifiers
- Price by location support
- Availability schedules

### Order Flow
- Cart creation → order placement
- Order types: dine-in, takeout, delivery
- Kitchen display integration
- Status updates: received → cooking → ready

---

## (vi) What We Can Adapt

**✅ MIT = Adaptation allowed with attribution**

- Reservation booking logic
- Table availability algorithms
- Menu/category modeling
- Order type handling
- Floor plan concepts

---

## (vii) What Nimbus Should Learn

1. **Table booking algorithm** — Check capacity, party size, time slots

2. **Reservation states** — Pending → Confirmed → Seated → Completed / No-show

3. **Menu modifiers** — Options, add-ons, variant pricing

4. **Order types** — Dine-in, takeout, delivery with different workflows

5. **Location-based menus** — Different menus/prices per branch

6. **Floor plan modeling** — Tables with coordinates, sections

7. **Time slot availability** — Booking slots with duration and turnover

8. **Customer history** — Past orders, preferences, notes

9. **Kitchen ticket generation** — Order → kitchen display items

10. **Delivery zones** — Geographic delivery area configuration

11. **Working hours** — Location operating schedules

12. **Guest count tracking** — Party size for capacity planning
