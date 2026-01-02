# cypress MAP

> **Repository:** https://github.com/cypress-io/cypress  
> **License:** ✅ MIT (adaptation allowed with attribution)  
> **Domain:** QA / E2E Testing  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

JavaScript E2E testing framework. Best reference for:
- Custom command patterns
- Network interception (cy.intercept)
- Component testing
- Time travel debugging
- Retry-ability design
- Test organization patterns

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript / JavaScript |
| Runner | Electron |
| Browser | Chromium, Firefox, Edge |
| Build | pnpm workspaces |
| Dashboard | Cypress Cloud (SaaS) |

---

## (iii) High-Level Directory Map

```
cypress/
├── packages/
│   ├── driver/              # In-browser test driver
│   │   └── src/
│   │       ├── cy/          # cy.* commands
│   │       └── cypress/     # Core driver
│   ├── server/              # Backend server
│   ├── runner/              # Test runner UI
│   ├── reporter/            # Results reporter
│   └── config/              # Configuration
├── cli/                     # Command-line interface
└── scripts/                 # Build scripts
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Commands | `packages/driver/src/cy/commands/` |
| Intercept | `packages/driver/src/cy/commands/request.ts` |
| Assertions | `packages/driver/src/cy/assertions/` |
| Retry logic | `packages/driver/src/cy/retry.ts` |
| Config | `packages/config/src/` |
| Reporter | `packages/reporter/src/` |

---

## (v) Key Flows

### Command Chain Flow
- Commands queue up (don't execute immediately)
- Each command yields a subject
- Next command operates on previous subject
- Automatic retry until timeout

### Intercept Flow
- Define route matcher: `cy.intercept('GET', '/api/*')`
- Request matches → handler invoked
- Can stub response or passthrough
- Wait for specific requests: `cy.wait('@alias')`

### Retry-ability
- Assertions automatically retry
- DOM queries retry until element found
- Timeout is configurable
- Helps with async UI

---

## (vi) What We Can Adapt

**✅ MIT = Adaptation allowed with attribution**

- Custom command patterns
- Intercept architecture
- Retry logic design
- Assertion chaining
- Test organization

---

## (vii) What Nimbus Should Learn

1. **Command chaining** — Fluent API for test steps

2. **Custom commands** — Reusable test actions

3. **Intercept patterns** — Route matching, response stubbing

4. **Alias system** — Name requests/elements for later reference

5. **Retry-ability** — Automatic retry for assertions

6. **Fixtures** — Load test data from files

7. **beforeEach hooks** — Setup before each test

8. **cy.session()** — Cache login state across tests

9. **Component testing** — Mount components in isolation

10. **Viewport management** — Test responsive behavior

11. **Screenshot/video** — Capture on failure

12. **Environment variables** — Config across environments
