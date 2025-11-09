/**
 * E54-s2: Latency Mix Stress Test
 * Run with CHAOS_LATENCY_MS=150 to inject artificial delays.
 * Ensures APIs still meet p99 < 1200ms under moderate latency.
 */

import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '1m', target: 10 },
    { duration: '2m', target: 30 },
    { duration: '1m', target: 10 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<1200'], // p99 must be under 1200ms
    http_req_failed: ['rate<0.05'], // < 5% errors
    errors: ['rate<0.05'],
  },
};

const API_URL = __ENV.API_URL || 'http://localhost:3001';
const ORG_ID = __ENV.ORG_ID || 'test-org-1';

const endpoints = [
  { method: 'GET', url: '/ops/health' },
  { method: 'GET', url: '/ops/ready' },
  { method: 'GET', url: '/menu/items' },
  { method: 'GET', url: '/analytics/top-items' },
];

export default function () {
  // Pick random endpoint
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];

  const res = http.get(`${API_URL}${endpoint.url}`, {
    headers: {
      'x-org-id': ORG_ID,
    },
  });

  const success = check(res, {
    'status 200': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 1200,
  });

  if (!success) {
    errorRate.add(1);
  } else {
    errorRate.add(0);
  }

  sleep(0.1);
}
