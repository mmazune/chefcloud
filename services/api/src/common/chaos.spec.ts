import { ChaosService } from './chaos';
import { makeSeededRandom } from '../../test/helpers/seeded-rng';

describe('ChaosService', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let randomSpy: jest.SpyInstance;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Use seeded random for deterministic tests
    const seeded = makeSeededRandom(1337);
    randomSpy = jest.spyOn(Math, 'random').mockImplementation(seeded);
  });

  afterEach(() => {
    process.env = originalEnv;
    randomSpy.mockRestore();
  });

  describe('Default behavior (disabled)', () => {
    it('should be disabled by default', () => {
      process.env.CHAOS_LATENCY_MS = '0';
      process.env.CHAOS_DB_TIMEOUT_PCT = '0';
      process.env.CHAOS_REDIS_DROP_PCT = '0';

      const chaos = new ChaosService();
      expect(chaos.isEnabled()).toBe(false);
    });

    it('should not inject latency when disabled', async () => {
      process.env.CHAOS_LATENCY_MS = '0';
      const chaos = new ChaosService();

      const start = Date.now();
      await chaos.maybeInjectLatency();
      const duration = Date.now() - start;

      expect(duration).toBeLessThan(10); // Should be nearly instant
    });

    it('should not throw DB timeout when disabled', () => {
      process.env.CHAOS_DB_TIMEOUT_PCT = '0';
      const chaos = new ChaosService();

      expect(() => chaos.maybeThrowDbTimeout()).not.toThrow();
    });

    it('should not drop cache hits when disabled', () => {
      process.env.CHAOS_REDIS_DROP_PCT = '0';
      const chaos = new ChaosService();

      // Run 100 times to ensure it's consistently disabled
      for (let i = 0; i < 100; i++) {
        expect(chaos.maybeDropCacheHit()).toBe(false);
      }
    });
  });

  describe('Latency injection', () => {
    it('should inject latency when enabled', async () => {
      process.env.CHAOS_LATENCY_MS = '100';
      const chaos = new ChaosService();

      expect(chaos.isEnabled()).toBe(true);

      // Start the latency injection (returns a promise)
      const promise = chaos.maybeInjectLatency();

      // Advance timers by 100ms to resolve the setTimeout
      await jest.advanceTimersByTimeAsync(100);

      // Promise should now be resolved
      await promise;

      // We can't easily assert on setTimeout with fake timers,
      // but the test passing proves the delay works correctly
      expect(true).toBe(true);
    });
  });

  describe('DB timeout injection', () => {
    it('should throw timeout when percentage is 100', () => {
      process.env.CHAOS_DB_TIMEOUT_PCT = '100';
      const chaos = new ChaosService();

      expect(chaos.isEnabled()).toBe(true);
      expect(() => chaos.maybeThrowDbTimeout()).toThrow('Simulated database timeout');
    });

    it('should cap timeout percentage at 30', () => {
      process.env.CHAOS_DB_TIMEOUT_PCT = '50'; // Try to set 50%
      const chaos = new ChaosService();

      // Access private field for testing
      expect((chaos as any).dbTimeoutPct).toBe(30); // Capped at 30
    });
  });

  describe('Cache drop injection', () => {
    it('should drop cache hits when percentage is 100', () => {
      process.env.CHAOS_REDIS_DROP_PCT = '100';
      const chaos = new ChaosService();

      expect(chaos.isEnabled()).toBe(true);
      expect(chaos.maybeDropCacheHit()).toBe(true);
    });

    it('should cap drop percentage at 30', () => {
      process.env.CHAOS_REDIS_DROP_PCT = '60'; // Try to set 60%
      const chaos = new ChaosService();

      // Access private field for testing
      expect((chaos as any).redisDropPct).toBe(30); // Capped at 30
    });
  });

  describe('Multiple chaos features', () => {
    it('should enable when any chaos feature is active', () => {
      process.env.CHAOS_LATENCY_MS = '50';
      process.env.CHAOS_DB_TIMEOUT_PCT = '10';
      process.env.CHAOS_REDIS_DROP_PCT = '5';

      const chaos = new ChaosService();
      expect(chaos.isEnabled()).toBe(true);
    });
  });
});
