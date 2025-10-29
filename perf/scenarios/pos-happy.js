// E54-s1: POS happy path - place/send/close orders (70% DINE_IN, 30% TAKEAWAY)
import { check, sleep } from 'k6';
import http from 'k6/http';

export const options = {
  scenarios: {
    pos_mix: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '30s', target: 20 }, // Ramp up
        { duration: '3m', target: 50 },  // Sustain 50 RPS mix
        { duration: '30s', target: 0 },  // Ramp down
      ],
    },
  },
  thresholds: {
    'http_req_duration{name:create_order}': ['p(95)<350', 'p(99)<800'],
    'http_req_duration{name:send_order}': ['p(95)<350', 'p(99)<800'],
    'http_req_duration{name:close_order}': ['p(95)<350', 'p(99)<800'],
    'http_req_failed': ['rate<0.05'], // <5% errors
  },
};

const BASE_URL = __ENV.API_URL || 'http://localhost:3001';
const TOKEN = __ENV.AUTH_TOKEN || 'your-test-jwt-token';

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${TOKEN}`,
};

export default function () {
  const serviceType = Math.random() < 0.7 ? 'DINE_IN' : 'TAKEAWAY';
  
  // 1. Create order
  const createPayload = JSON.stringify({
    tableId: serviceType === 'DINE_IN' ? 'table-1' : undefined,
    serviceType,
    items: [
      { menuItemId: 'item-1', quantity: 2, notes: 'No onions' },
      { menuItemId: 'item-2', quantity: 1 },
    ],
  });

  const createRes = http.post(`${BASE_URL}/pos/orders`, createPayload, {
    headers,
    tags: { name: 'create_order' },
  });

  const orderCreated = check(createRes, {
    'order created': (r) => r.status === 201,
    'has orderId': (r) => r.json('id') !== undefined,
  });

  if (!orderCreated) return;

  const orderId = createRes.json('id');
  sleep(0.5);

  // 2. Send to kitchen
  const sendRes = http.patch(
    `${BASE_URL}/pos/orders/${orderId}/send`,
    null,
    {
      headers,
      tags: { name: 'send_order' },
    }
  );

  check(sendRes, {
    'order sent': (r) => r.status === 200,
  });

  sleep(1);

  // 3. Close order (simplified - real flow would mark served first)
  const closePayload = JSON.stringify({
    payments: [{ method: 'CASH', amount: 25000 }],
  });

  const closeRes = http.patch(
    `${BASE_URL}/pos/orders/${orderId}/close`,
    closePayload,
    {
      headers,
      tags: { name: 'close_order' },
    }
  );

  check(closeRes, {
    'order closed': (r) => r.status === 200,
  });

  sleep(1);
}
