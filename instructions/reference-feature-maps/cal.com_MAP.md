# cal.com MAP

> **Repository:** https://github.com/calcom/cal.com  
> **License:** ⚠️ AGPL-3.0 (study only — no code copying)  
> **Domain:** Scheduling Infrastructure  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Modern scheduling infrastructure platform. Best reference for:
- Complex availability engine
- Event types and booking pages
- Team scheduling and round-robin
- Calendar integrations
- Video conferencing integrations
- Recurring events
- Timezone handling

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | Next.js 13+ / React |
| Backend | tRPC / Prisma |
| Database | PostgreSQL |
| Queue | Inngest |
| Calendar | CalDAV / Google / Outlook |
| Video | Zoom / Google Meet / Daily.co |
| Build | Turbo monorepo |

---

## (iii) High-Level Directory Map

```
cal.com/
├── apps/
│   ├── web/                 # Main Next.js app
│   │   ├── pages/
│   │   └── lib/
│   └── api/                 # API routes
├── packages/
│   ├── prisma/              # Database schema
│   ├── lib/                 # Core libraries
│   │   ├── slots.ts         # Slot calculation
│   │   └── availability.ts  # Availability engine
│   ├── features/            # Feature modules
│   │   ├── bookings/
│   │   ├── eventtypes/
│   │   └── schedules/
│   └── trpc/                # tRPC routers
└── docs/                    # Documentation
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Slot calculation | `packages/lib/slots.ts` |
| Availability engine | `packages/lib/availability.ts` |
| Booking logic | `packages/features/bookings/` |
| Event types | `packages/features/eventtypes/` |
| Schedules | `packages/features/schedules/` |
| Calendar integrations | `packages/app-store/` |
| Prisma schema | `packages/prisma/schema.prisma` |

---

## (v) Key Flows

### Availability Calculation Flow
- Load user's schedule (working hours)
- Load calendar busy times (connected calendars)
- Load existing bookings
- Calculate intersection → available slots
- Apply buffer times before/after

### Event Type Flow
- Define event type (duration, buffer, limits)
- Set availability schedule
- Generate booking link
- Handle round-robin for teams

### Booking Flow
- Visitor selects time slot
- Validates slot availability (real-time check)
- Collects booking info
- Creates booking + calendar events
- Sends confirmations to all parties

---

## (vi) What We Can Adapt

**⚠️ AGPL-3.0 = STUDY ONLY**

---

## (vii) What Nimbus Should Learn

1. **Slot calculation algorithm** — Efficient time slot generation

2. **Multiple calendar aggregation** — Merge busy times from various sources

3. **Timezone handling** — Display in booker's timezone, store in UTC

4. **Event type configuration** — Duration, buffer, min notice, limits

5. **Team scheduling** — Round-robin, collective availability

6. **Recurring availability** — Weekly schedule patterns

7. **Buffer times** — Before/after event padding

8. **Daily/weekly limits** — Max bookings per day/week

9. **Booking questions** — Custom fields on booking form

10. **Rescheduling flow** — Move bookings with notifications

11. **Cancellation handling** — Cancel with reason, notify parties

12. **Calendar write-back** — Create events in connected calendars
