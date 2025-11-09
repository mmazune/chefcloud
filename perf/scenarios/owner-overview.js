// E54-s1: Owner overview polling - hit /owner/overview every 2s
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    owner_polling: {
      executor: 'constant-vus',
      vus: 25,
      duration: '5m',
    },
  },
  thresholds: {
    'http_req_duration{name:owner_overview}': ['p(95)<350', 'p(99)<800'],
    http_req_failed: ['rate<0.05'], // <5% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'your-test-jwt-token';

export default function () {
  const params = {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
    tags: { name: 'owner_overview' },
  };

  const res = http.get(`${BASE_URL}/owner/overview`, params);

  check(res, {
    'overview success': (r) => r.status === 200,
    'has branches': (r) => Array.isArray(r.json('branches')),
  });

  sleep(2); // Poll every 2s
}
