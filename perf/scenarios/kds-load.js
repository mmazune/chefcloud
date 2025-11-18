// M1-KDS: KDS load test - concurrent KDS clients polling queue and SSE streams
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    kds_polling: {
      executor: 'constant-vus',
      vus: 50,
      duration: '2m',
      exec: 'pollKdsQueue',
    },
    kds_sse: {
      executor: 'constant-vus',
      vus: 20,
      duration: '2m',
      exec: 'streamKds',
    },
  },
  thresholds: {
    'http_req_duration{name:kds_queue}': ['p(95)<300'], // Queue fetch < 300ms
    'http_req_duration{name:kds_sse}': ['p(95)<500'], // SSE connect < 500ms
    http_req_failed: ['rate<0.05'], // <5% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'your-test-jwt-token';

const STATIONS = ['GRILL', 'FRYER', 'BAR'];

/**
 * Polling scenario: repeatedly fetch KDS queue
 */
export function pollKdsQueue() {
  const station = STATIONS[Math.floor(Math.random() * STATIONS.length)];

  const params = {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
    },
    tags: { name: 'kds_queue' },
  };

  const res = http.get(`${BASE_URL}/kds/queue?station=${station}`, params);

  check(res, {
    'queue fetch success': (r) => r.status === 200,
    'queue is array': (r) => {
      try {
        const body = JSON.parse(r.body);
        return Array.isArray(body);
      } catch {
        return false;
      }
    },
    'tickets have waiterName': (r) => {
      try {
        const body = JSON.parse(r.body);
        return body.length === 0 || body[0].waiterName !== undefined;
      } catch {
        return false;
      }
    },
    'tickets have slaState': (r) => {
      try {
        const body = JSON.parse(r.body);
        return (
          body.length === 0 || ['GREEN', 'ORANGE', 'RED'].includes(body[0].slaState)
        );
      } catch {
        return false;
      }
    },
  });

  sleep(1); // Poll every 1 second
}

/**
 * SSE scenario: connect to KDS stream
 */
export function streamKds() {
  const station = STATIONS[Math.floor(Math.random() * STATIONS.length)];

  const params = {
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      Accept: 'text/event-stream',
    },
    tags: { name: 'kds_sse' },
    timeout: '5s',
  };

  const res = http.get(`${BASE_URL}/stream/kds?station=${station}`, params);

  check(res, {
    'SSE connect success': (r) => r.status === 200,
    'SSE content type': (r) => r.headers['Content-Type']?.includes('text/event-stream'),
  });

  sleep(5); // Simulate connection staying open
}
