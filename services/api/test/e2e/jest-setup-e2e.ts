import 'reflect-metadata';

// Test-safe env
(process.env as any).NODE_ENV = 'test';
process.env.METRICS_ENABLED = '0';
process.env.DOCS_ENABLED = '0';
process.env.ERROR_INCLUDE_STACKS = '0';
process.env.EVENTS_ENABLED = '0'; // use Noop where applicable

// Authentication
process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key';

// Database (stubbed in tests, but needed for config validation)
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/chefcloud_test';

// Rate limiting (low values for deterministic 429 testing)
process.env.PLAN_RATE_LIMIT = '5';

// Webhook secret for HMAC tests
process.env.WH_SECRET = 'whsec_test_123';

// Plan-aware throttling knobs used by Dev-Portal test module
process.env.PLAN_LIMIT_FREE = '5';   // requests per 30s window
process.env.PLAN_LIMIT_PRO  = '50';  // requests per 30s window
process.env.PLAN_WINDOW_SEC = '30';
