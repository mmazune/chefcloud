# E2E on Compiled JS — Outcome Report

**Date**: November 10, 2025  
**Task**: Run E2E tests against compiled JavaScript to bypass ts-jest metatype error  
**Status**: ⚠️ BLOCKED - Error persists in compiled JS (not a ts-jest issue)

## Summary

Attempted to bypass ts-jest transform issues by compiling TypeScript to JavaScript and running E2E tests against `dist/`. **Discovery: The `TypeError: metatype is not a constructor` error persists even with pure compiled JavaScript**, indicating this is NOT a ts-jest problem but an actual production DI issue unrelated to the CacheModule/ObservabilityModule fixes.

## Root Cause Analysis

### Error Location
- **Module**: EventsModule (index 23 in AppModule → StreamModule → EventsModule)
- **Provider**: EventBusService (index 0 in EventsModule.providers array)
- **Error**: `TypeError: metatype is not a constructor`

### Evidence

1. **Compiled JS Test Run**:
   ```bash
   $ pnpm build:e2e  # Compile TS to JS
   $ pnpm test:e2e-js  # Run Jest on dist/*.js
   
   Result: SAME ERROR - "metatype is not a constructor"
   ```

2. **Direct Node.js Verification**:
   ```javascript
   const {EventBusService} = require('./dist/src/events/event-bus.service');
   const {EventsModule} = require('./dist/src/events/events.module');
   console.log(EventBusService);  // [class EventBusService] ✓
   console.log(EventsModule);      // [class EventsModule] ✓
   console.log(Reflect.getMetadata('providers', EventsModule));
   // [ [class EventBusService] ] ✓
   ```
   
   **All exports are valid classes** when loaded directly.

3. **Compiled Code Inspection**:
   - `dist/src/events/event-bus.service.js` - Proper class with `@Injectable()` decorator ✓
   - `dist/src/events/events.module.js` - Proper `@Module()` with EventBusService in providers ✓
   - No circular imports detected in EventsModule itself ✓

### Hypothesis

When NestJS TestingModule compiles the full AppModule graph:
- All modules up to index 22 initialize successfully
- StreamModule (index 23) imports EventsModule
- EventsModule attempts to instantiate EventBusService (index 0)
- **At this point, something in the NestJS DI container resolves EventBusService to a non-constructor value**

Possible causes:
1. **Circular dependency** triggered only when full AppModule loads (not detectable in isolation)
2. **Metadata corruption** when multiple modules import EventsModule (PosModule, KdsModule, StreamModule, HardwareModule all import it)
3. **Global module conflict** - some global provider interfering with EventBusService resolution
4. **NestJS Testing module bug** with specific module graph structure

## Files Created

### Configuration Files
- ✅ `services/api/tsconfig.build.e2e.json` - TypeScript config to compile src + tests
- ✅ `services/api/jest-e2e-js.json` - Jest config for compiled JS tests
- ✅ `services/api/test/e2e/jest-setup-e2e.ts` - Updated with reflect-metadata import

### Package Scripts
- ✅ `build:e2e` - Compile src and tests to dist/
- ✅ `test:e2e-js` - Run Jest on compiled JavaScript

### Test Files
- ✅ `test/smoke/minimal-boot.e2e-spec.ts` - Minimal boot test (compiled successfully)
- ⚠️ `test/billing-simple.e2e-spec.ts` - Import fixes needed (PrismaService path)

## Test Execution

### Build Phase
```bash
$ cd services/api
$ pnpm build:e2e

✓ Compiled 582 TypeScript files
✓ dist/src/**/*.js (production code)
✓ dist/test/smoke/minimal-boot.e2e-spec.js
✓ dist/test/e2e/jest-setup-e2e.js
```

### Test Phase
```bash
$ pnpm test:e2e-js

FAIL dist/test/smoke/minimal-boot.e2e-spec.js
  Minimal Boot Test
    ✕ should boot AppModule without errors (76 ms)

  TypeError: metatype is not a constructor
    at TestingInjector.instantiateClass (injector.js:373:19)
    at Promise.all (index 0)  ← EventBusService
    at Promise.all (index 23) ← StreamModule
```

**Boot time before error**: 76ms (fast failure - not hanging)

## Acceptance Criteria

| Criterion | Target | Result |
|-----------|--------|--------|
| App boots for E2E in <3s | <3s | ⚠️ N/A - Boot fails at 76ms |
| 11/11 E2E cases run | 11/11 | ⛔ 0/11 - Module compilation fails |
| ≥1 test sees HTTP 429 | Yes | ⛔ N/A - No HTTP server |
| No metatype error | None | ⛔ ERROR PERSISTS |
| Commit report | Yes | ✅ THIS FILE |

**% Complete**: 40% (infrastructure ready, but blocked on unrelated DI issue)

## Key Discovery

### ts-jest is NOT the Problem

The original task assumed ts-jest transform was causing the metatype error. **This assumption is FALSE**. The error occurs in:
- ✅ ts-jest loading TypeScript source
- ✅ Jest loading compiled JavaScript  
- ✅ NestJS TestingModule (not regular app bootstrap)

The error is **specific to NestJS testing infrastructure** when loading the full AppModule dependency graph.

## Comparison: Production DI Fixes vs. EventBusService Issue

### CacheModule/ObservabilityModule Fixes (SUCCESSFUL ✅)
- **Problem**: Missing module imports for cross-module dependencies
- **Error**: "Nest can't resolve dependencies of XService (?)"
- **Solution**: Add proper `imports: [CacheModule]` to consuming modules
- **Result**: Fixed 10 modules, build passes, unit tests pass

### EventBusService Issue (UNRESOLVED ⚠️)
- **Problem**: EventBusService resolves to non-constructor in TestingModule
- **Error**: "TypeError: metatype is not a constructor"
- **Not caused by**: Missing imports (EventsModule properly configured)
- **Not caused by**: ts-jest (persists in compiled JS)
- **Likely cause**: Module graph circular dependency or TestingModule bug

## Next Steps (Recommendations)

### Immediate (Bypass Testing Issues)
1. **Use integration tests** instead of TestingModule:
   ```typescript
   // Don't use Test.createTestingModule
   // Instead, start actual app and test HTTP endpoints
   const app = await NestFactory.create(AppModule);
   await app.listen(3000);
   // Then use supertest against http://localhost:3000
   ```

2. **Test modules in isolation**:
   ```typescript
   // Instead of importing full AppModule
   await Test.createTestingModule({
     imports: [BillingModule], // Test one module at a time
   }).compile();
   ```

### Short-term (Debug EventBusService)
1. **Remove StreamModule** from AppModule temporarily to confirm it's the trigger
2. **Check for circular dependencies** with madge or dpdm:
   ```bash
   npx madge --circular services/api/src
   ```
3. **Test EventsModule in isolation**:
   ```typescript
   const mod = await Test.createTestingModule({
     imports: [EventsModule],
   }).compile();
   const eventBus = mod.get(EventBusService);
   // If this works, the issue is in the full module graph
   ```

### Long-term (Test Infrastructure)
1. **Migrate to Vitest** - Better ESM support, faster
2. **Use @swc/jest** instead of ts-jest - Faster transforms
3. **Separate E2E from unit tests** - Don't load full AppModule in tests

## Conclusion

The E2E on compiled JS approach **successfully proves ts-jest is innocent**. The metatype error is a real production issue with EventBusService/EventsModule that manifests only when:
- Loading the full AppModule dependency graph
- Using NestJS TestingModule (not production bootstrap)

**Production DI fixes remain valid** ✅ - The CacheModule/ObservabilityModule work correctly fixed 10 real DI issues.

**EventBusService issue is separate** ⚠️ - Requires investigation into:
- EventsModule's role in the module graph
- Why TestingModule fails but production works
- Potential circular dependencies invisible to direct inspection

---

**Infrastructure Status**: ✅ Ready (can compile and run JS tests)  
**Test Execution**: ⛔ Blocked on unrelated EventBusService DI issue  
**Production Code**: ✅ DI hygiene fixes successful, build passing
