import { metricsStore } from './ops.service';

describe('MetricsStore', () => {
  beforeEach(() => {
    // Reset metrics before each test
    const allMetrics = metricsStore.getAll();
    allMetrics.forEach((_, key) => {
      metricsStore.increment(key, -metricsStore.get(key));
    });
  });

  it('should increment counter', () => {
    metricsStore.increment('test_counter', 5);
    expect(metricsStore.get('test_counter')).toBe(5);

    metricsStore.increment('test_counter', 3);
    expect(metricsStore.get('test_counter')).toBe(8);
  });

  it('should return 0 for non-existent counter', () => {
    expect(metricsStore.get('non_existent')).toBe(0);
  });

  it('should track multiple metrics', () => {
    metricsStore.increment('requests_total', 10);
    metricsStore.increment('errors_total', 2);
    metricsStore.increment('queue_jobs_total', 5);

    expect(metricsStore.get('requests_total')).toBe(10);
    expect(metricsStore.get('errors_total')).toBe(2);
    expect(metricsStore.get('queue_jobs_total')).toBe(5);
  });
});
