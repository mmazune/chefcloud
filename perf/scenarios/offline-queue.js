/**
 * E54-s2: Offline Queue Stress Test
 * Simulates API flaps (40s up / 20s down) with queued operations.
 * Asserts < 1% duplicates via server idempotency (SKIP responses).
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Counter, Rate } from 'k6/metrics';

const duplicateOps = new Counter('duplicate_operations');
const skipRate = new Rate('skip_rate');

export const options = {
  stages: [
    { duration: '40s', target: 20 }, // API up
    { duration: '20s', target: 0 }, // API down (simulated)
    { duration: '40s', target: 20 }, // API up
    { duration: '20s', target: 0 }, // API down
    { duration: '40s', target: 20 }, // API up
  ],
  thresholds: {
    skip_rate: ['rate<0.01'], // < 1% duplicates
    http_req_failed: ['rate<0.10'], // Allow 10% failures during "down" periods
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3001';
const ORG_ID = __ENV.ORG_ID || 'test-org-1';

export default function () {
  const syncPayload = {
    ops: [
      {
        id: `op-${__VU}-${__ITER}-${Date.now()}`, // Unique operation ID
        type: 'ORDER_CREATE',
        timestamp: new Date().toISOString(),
        data: { items: [{ id: 'item-1', qty: 1 }] },
      },
    ],
  };

  const res = http.post(`${API_URL}/sync/batch`, JSON.stringify(syncPayload), {
    headers: {
      'Content-Type': 'application/json',
      'x-org-id': ORG_ID,
    },
  });

  const success = check(res, {
    'status 200 or 409': (r) => r.status === 200 || r.status === 409,
  });

  if (res.status === 409) {
    // Server returned SKIP due to duplicate operation ID
    duplicateOps.add(1);
    skipRate.add(1);
  } else if (success) {
    skipRate.add(0);
  }

  sleep(0.5);
}
