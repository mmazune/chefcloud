# playwright MAP

> **Repository:** https://github.com/microsoft/playwright  
> **License:** ✅ Apache-2.0 (adaptation allowed with attribution)  
> **Domain:** QA / E2E Testing  
> **Last Reviewed:** 2026-01-02

---

## (i) What This Repo Is Best For

Cross-browser E2E testing framework. Best reference for:
- Page Object Model patterns
- Test fixtures and setup
- Parallel test execution
- Browser automation patterns
- Screenshot/video capture
- Network interception
- HTML test reports

---

## (ii) Tech Stack

| Layer | Technology |
|-------|------------|
| Language | TypeScript / JavaScript |
| Browsers | Chromium, Firefox, WebKit |
| Protocol | Chrome DevTools Protocol + proprietary |
| Build | pnpm workspaces |
| Reports | HTML Reporter |

---

## (iii) High-Level Directory Map

```
playwright/
├── packages/
│   ├── playwright/              # Main package
│   ├── playwright-core/         # Core automation
│   │   └── src/
│   │       ├── client/          # API client
│   │       ├── server/          # Browser control
│   │       └── protocol/        # Communication
│   ├── playwright-test/         # Test runner (in playwright pkg)
│   └── html-reporter/           # HTML reports
├── tests/                       # Playwright's own tests
└── docs/                        # Documentation
```

---

## (iv) Where the "Important Stuff" Lives

| Feature | Path |
|---------|------|
| Test runner | `packages/playwright/src/runner/` |
| Fixtures | `packages/playwright/src/fixtures.ts` |
| Page API | `packages/playwright-core/src/client/page.ts` |
| Locators | `packages/playwright-core/src/client/locator.ts` |
| Assertions | `packages/playwright/src/expect.ts` |
| HTML Reporter | `packages/html-reporter/src/` |
| Config | `packages/playwright/src/config.ts` |

---

## (v) Key Flows

### Test Execution Flow
- Load config → discover test files
- Parse tests → build test tree
- Allocate to workers (parallel)
- Run fixtures → execute tests → cleanup
- Collect results → generate report

### Fixture Pattern
- Fixtures provide test dependencies
- Setup runs before test
- Teardown runs after (cleanup)
- Fixtures can depend on other fixtures
- Scopes: test, worker, global

### Page Object Pattern (recommended usage)
```typescript
class LoginPage {
  constructor(private page: Page) {}
  
  async login(email: string, password: string) {
    await this.page.fill('[name=email]', email);
    await this.page.fill('[name=password]', password);
    await this.page.click('button[type=submit]');
  }
}
```

---

## (vi) What We Can Adapt

**✅ Apache-2.0 = Adaptation allowed with attribution**

- Fixture architecture patterns
- Page Object Model approach
- Parallel execution strategy
- HTML report format
- Configuration patterns

---

## (vii) What Nimbus Should Learn

1. **Fixture pattern** — Dependency injection for tests

2. **Page Object Model** — Encapsulate page interactions

3. **Locator strategies** — Reliable element selection

4. **Auto-waiting** — Wait for elements/conditions automatically

5. **Network interception** — Mock API responses

6. **Parallel execution** — Worker-based parallelism

7. **Retry logic** — Flaky test handling

8. **Screenshot on failure** — Capture state for debugging

9. **Trace files** — Record/playback for debugging

10. **Configuration structure** — Projects, browsers, reporters

11. **Test isolation** — Each test gets fresh context

12. **Annotations** — Skip, only, fixme, slow markers
