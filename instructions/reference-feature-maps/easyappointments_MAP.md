# easyappointments MAP

> **Repository:** https://github.com/alextselegidis/easyappointments  
> **License:** ⚠️ AGPL-3.0 (study only — no code copying)  
> **Domain:** Appointment Scheduling  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Self-hosted appointment scheduling. Best reference for:
- Provider/service scheduling
- Time slot availability calculation
- Booking widget for public websites
- Customer self-service booking
- Email/SMS reminders
- Calendar synchronization

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | PHP / CodeIgniter |
| Database | MySQL |
| Frontend | jQuery / Bootstrap |
| Calendar | FullCalendar |
| API | REST |

---

## (iii) High-Level Directory Map

```
easyappointments/
├── application/
│   ├── controllers/
│   ├── models/
│   ├── libraries/
│   └── views/
├── assets/
│   ├── js/
│   └── css/
└── storage/
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Booking controller | `application/controllers/Booking.php` |
| Appointments model | `application/models/Appointments_model.php` |
| Providers model | `application/models/Providers_model.php` |
| Services model | `application/models/Services_model.php` |
| Availability logic | `application/libraries/Availability.php` |
| Calendar sync | `application/libraries/Google_sync.php` |

---

## (v) Key Flows

### Availability Calculation Flow
- Get provider's working hours
- Get existing appointments
- Calculate open slots based on service duration
- Account for breaks and blocked times
- Return available time slots

### Booking Flow
- Customer selects service → provider → date → time
- Validates slot still available
- Creates appointment record
- Sends confirmation email
- Optional: Syncs to Google Calendar

---

## (vi) What We Can Adapt

**⚠️ AGPL-3.0 = STUDY ONLY**

---

## (vii) What Nimbus Should Learn

1. **Availability algorithm** — Working hours minus booked slots

2. **Service duration** — Variable-length appointments

3. **Provider working hours** — Per-day schedules with breaks

4. **Booking buffer** — Time between appointments for prep

5. **Customer-facing widget** — Embeddable booking interface

6. **Confirmation workflow** — Email/SMS on booking

7. **Cancellation policy** — Time-based cancellation rules

8. **Recurring appointments** — Weekly/monthly repeating bookings

9. **Calendar sync** — Two-way Google/Outlook integration

10. **Waitlist** — Queue when slots full
