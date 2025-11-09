import { Injectable } from '@nestjs/common';
import { collectDefaultMetrics, Counter, Histogram, Gauge, Registry } from 'prom-client';

@Injectable()
export class MetricsService {
  private readonly reg = new Registry();
  readonly enabled = process.env.METRICS_ENABLED === '1';

  cacheHits!: Counter<string>;
  cacheMisses!: Counter<string>;
  rateLimitHits!: Counter<string>;
  webhookVerifications!: Counter<string>;
  invalidations!: Counter<string>;
  dbQueryMs!: Histogram<string>;
  sseClients!: Gauge<string>;

  constructor() {
    if (!this.enabled) return;

    collectDefaultMetrics({ register: this.reg, prefix: 'chefcloud_' });

    this.cacheHits = new Counter({
      name: 'cache_hits_total',
      help: 'Cache hits',
      labelNames: ['endpoint'],
      registers: [this.reg],
    });

    this.cacheMisses = new Counter({
      name: 'cache_misses_total',
      help: 'Cache misses',
      labelNames: ['endpoint'],
      registers: [this.reg],
    });

    this.rateLimitHits = new Counter({
      name: 'rate_limit_hits_total',
      help: 'Requests blocked by rate limiting',
      labelNames: ['route', 'kind'],
      registers: [this.reg],
    });

    this.webhookVerifications = new Counter({
      name: 'webhook_verification_total',
      help: 'Webhook verification results',
      labelNames: ['result'],
      registers: [this.reg],
    });

    this.invalidations = new Counter({
      name: 'cache_invalidations_total',
      help: 'Cache invalidations by prefix',
      labelNames: ['prefix'],
      registers: [this.reg],
    });

    this.dbQueryMs = new Histogram({
      name: 'db_query_ms_seconds',
      help: 'DB query time (seconds) labelled by endpoint and cached flag',
      labelNames: ['endpoint', 'cached'],
      buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
      registers: [this.reg],
    });

    this.sseClients = new Gauge({
      name: 'sse_clients_gauge',
      help: 'Current SSE clients connected',
      registers: [this.reg],
    });
  }

  async metrics(): Promise<string> {
    if (!this.enabled) return '# metrics disabled\n';
    return this.reg.metrics();
  }
}
