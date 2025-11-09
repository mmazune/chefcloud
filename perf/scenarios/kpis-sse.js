// E54-s1: SSE load test - 200 concurrent clients to /stream/kpis
import { check } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    sse_load: {
      executor: 'constant-vus',
      vus: 200,
      duration: '2m',
    },
  },
  thresholds: {
    'http_req_duration{name:sse_connect}': ['p(95)<500'], // SSE connect < 500ms
    http_req_failed: ['rate<0.05'], // <5% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'your-test-jwt-token';

export default function () {
  const params = {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'text/event-stream',
    },
    tags: { name: 'sse_connect' },
    timeout: '5s', // Initial connect timeout
  };

  const res = http.get(`${BASE_URL}/stream/kpis`, params);

  check(res, {
    'SSE connect success': (r) => r.status === 200,
    'SSE content type': (r) => r.headers['Content-Type']?.includes('text/event-stream'),
  });

  // Simulate client staying connected briefly
  // In real SSE, connection would stay open; k6 closes after response
}
