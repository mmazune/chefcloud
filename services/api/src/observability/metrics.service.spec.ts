import { MetricsService } from './metrics.service';

describe('MetricsService', () => {
  const prev = process.env.METRICS_ENABLED;

  beforeAll(() => {
    process.env.METRICS_ENABLED = '1';
  });

  afterAll(() => {
    process.env.METRICS_ENABLED = prev;
  });

  it('registers and renders metrics', async () => {
    const m = new MetricsService();
    m.cacheHits.inc({ endpoint: 'test' });
    m.dbQueryMs.observe({ endpoint: 'test', cached: 'false' }, 0.012);
    const txt = await m.metrics();
    expect(txt).toContain('cache_hits_total');
    expect(txt).toContain('db_query_ms_seconds_bucket');
  });

  it('returns disabled message when METRICS_ENABLED is not set', async () => {
    process.env.METRICS_ENABLED = '0';
    const m = new MetricsService();
    const txt = await m.metrics();
    expect(txt).toBe('# metrics disabled\n');
    process.env.METRICS_ENABLED = '1';
  });
});
