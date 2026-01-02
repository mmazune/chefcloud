# appsmith MAP

> **Repository:** https://github.com/appsmithorg/appsmith  
> **License:** ✅ Apache-2.0 (adaptation allowed with attribution)  
> **Domain:** UI Systems / Low-Code Platform  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Low-code application builder. Best reference for:
- Admin panel architecture
- Widget/component system
- Data binding patterns
- Form builders
- Query/action execution
- Visual editor design
- Multi-page application structure

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Backend | Java / Spring Boot |
| Frontend | React / TypeScript |
| State | Redux |
| Database | MongoDB |
| Build | Webpack |
| Editor | Canvas-based drag-drop |

---

## (iii) High-Level Directory Map

```
appsmith/
├── app/
│   ├── client/              # React frontend
│   │   ├── src/
│   │   │   ├── widgets/     # Widget definitions
│   │   │   ├── components/  # UI components
│   │   │   ├── pages/       # Application pages
│   │   │   ├── sagas/       # Redux sagas
│   │   │   └── reducers/    # Redux reducers
│   └── server/              # Java backend
│       └── appsmith-server/
│           └── src/
│               └── main/
│                   └── java/
├── contributions/           # Community widgets
└── deploy/                  # Deployment configs
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Widget registry | `app/client/src/widgets/` |
| Widget config | `app/client/src/widgets/*/widget/` |
| Data binding | `app/client/src/sagas/EvaluationsSaga.ts` |
| Query execution | `app/client/src/sagas/QueryPaneSagas.ts` |
| Form widget | `app/client/src/widgets/FormWidget/` |
| Table widget | `app/client/src/widgets/TableWidgetV2/` |
| Canvas | `app/client/src/layoutSystems/` |

---

## (v) Key Flows

### Widget Rendering Flow
- Widget config defines properties schema
- Canvas renders widgets based on layout
- Properties can bind to data via `{{ }}`
- Widget re-renders on data change

### Data Binding Flow
- Query returns data to store
- Widgets reference data: `{{Query1.data}}`
- Evaluation saga evaluates bindings
- Updates widget with resolved values

### Action Execution Flow
- User triggers action (button click)
- Action can be: Query, API call, JS function
- Executes and returns result
- Can chain actions: onSuccess, onError

---

## (vi) What We Can Adapt

**✅ Apache-2.0 = Adaptation allowed with attribution**

- Widget property configuration pattern
- Data binding expression syntax
- Form generation from schema
- Table column configuration
- Action/event handling model

---

## (vii) What Nimbus Should Learn

1. **Widget property schema** — Typed properties with defaults

2. **Binding expressions** — `{{ }}` syntax for dynamic values

3. **Widget composition** — Container widgets with children

4. **Form generation** — Schema-driven form creation

5. **Table column types** — Text, number, date, custom render

6. **Action chaining** — Success/error handlers

7. **Data source abstraction** — Query any API/DB uniformly

8. **Layout system** — Grid-based responsive layouts

9. **Theming** — Centralized style configuration

10. **Widget events** — onClick, onChange, onLoad patterns

11. **Validation** — Property and form validation

12. **Modal/drawer patterns** — Overlay component architecture
