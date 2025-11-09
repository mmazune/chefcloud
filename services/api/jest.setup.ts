// Polyfill atob/btoa for Node.js test environment
if (typeof global.atob === 'undefined') {
  global.atob = (str: string) => Buffer.from(str, 'base64').toString('binary');
}
if (typeof global.btoa === 'undefined') {
  global.btoa = (str: string) => Buffer.from(str, 'binary').toString('base64');
}

// Global test setup for deterministic behavior
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
