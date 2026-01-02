# kimai MAP

> **Repository:** https://github.com/kimai/kimai  
> **License:** ⚠️ AGPL-3.0 (study only — no code copying)  
> **Domain:** Time Tracking / Workforce  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Time tracking application for teams. Best reference for:
- Time entry / timesheet management
- Project and activity tracking
- Punch in/out (clock in/out)
- Team management
- Invoicing based on time
- Export and reporting
- API for integrations

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | PHP / Symfony |
| Database | MySQL / MariaDB |
| Frontend | Twig templates / Stimulus.js |
| API | REST (API Platform) |
| Theming | Bootstrap 5 |
| Export | PDF / Excel / CSV |

---

## (iii) High-Level Directory Map

```
kimai/
├── src/
│   ├── Activity/        # Activity management
│   ├── API/             # REST API
│   ├── Calendar/        # Calendar views
│   ├── Command/         # CLI commands
│   ├── Controller/      # Web controllers
│   ├── Customer/        # Customer/client management
│   ├── Entity/          # Doctrine entities
│   ├── Event/           # Domain events
│   ├── Export/          # Export features
│   ├── Form/            # Form types
│   ├── Invoice/         # Invoicing
│   └── Timesheet/       # Core timesheet logic
├── config/              # Symfony config
└── templates/           # Twig templates
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Timesheet entity | `src/Entity/Timesheet.php` |
| Timesheet service | `src/Timesheet/TimesheetService.php` |
| Activity entity | `src/Entity/Activity.php` |
| Project entity | `src/Entity/Project.php` |
| Customer entity | `src/Entity/Customer.php` |
| Time calculations | `src/Timesheet/Calculator/` |
| Export | `src/Export/` |
| Invoice | `src/Invoice/` |

---

## (v) Key Flows

### Time Entry Flow
- Create timesheet entry (start, end, project, activity)
- Calculate duration automatically
- Apply hourly rate (from user/project/activity)
- Optionally: export, invoice

### Punch Clock Flow
- User "punches in" → starts running timer
- User "punches out" → stops timer, saves duration
- Running timers shown in dashboard
- Only one active timer per user

### Invoice Generation Flow
- Select uninvoiced timesheet entries
- Group by customer/project
- Apply rates and calculate totals
- Generate PDF/HTML invoice
- Mark entries as invoiced

---

## (vi) What We Can Adapt

**⚠️ AGPL-3.0 = STUDY ONLY**

---

## (vii) What Nimbus Should Learn

1. **Timesheet data model** — Start, end, duration, breaks

2. **Running timer pattern** — Open-ended entries with live duration

3. **Rate hierarchy** — User rate → Project rate → Activity rate

4. **Billable vs non-billable** — Flag for invoicing

5. **Activity hierarchy** — Global activities vs project-specific

6. **Duration calculations** — Handle pauses, rounding rules

7. **Time rounding** — Round to nearest 15 min, etc.

8. **Budget tracking** — Project/activity time budgets

9. **Overtime calculation** — Hours beyond daily/weekly thresholds

10. **Team visibility** — Who can see whose time entries

11. **Export formats** — PDF, Excel, CSV for payroll

12. **Approval workflow** — Submit → Review → Approve timesheets
