/**
 * Global Jest setup for deterministic tests
 * Configures fake timers and cleanup hooks
 */

beforeEach(() => {
  // Use modern fake timers for each test
  jest.useFakeTimers({ legacyFakeTimers: false });
  // Set a consistent system time
  jest.setSystemTime(new Date('2025-11-08T00:00:00.000Z'));
});

afterEach(async () => {
  // Run all pending timers to avoid leaks
  jest.runOnlyPendingTimers();
  // Clear all timers
  jest.clearAllTimers();
  // Restore all mocks
  jest.restoreAllMocks();
  // Use real timers after test
  jest.useRealTimers();
});
