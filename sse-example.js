#!/usr/bin/env node
/**
 * SSE Stream Example - ChefCloud Live Streams (M7-s2)
 *
 * Connects to ChefCloud SSE endpoints and logs events in real-time.
 *
 * Usage:
 *   node sse-example.js spout [deviceId]
 *   node sse-example.js kds [station]
 *
 * Examples:
 *   node sse-example.js spout
 *   node sse-example.js spout device-abc123
 *   node sse-example.js kds
 *   node sse-example.js kds GRILL
 */

const http = require('http');

const API_URL = process.env.API_URL || 'http://localhost:3001';
const TOKEN = process.env.L3_TOKEN || 'your-l3-token-here';

const stream = process.argv[2]; // 'spout' or 'kds'
const filter = process.argv[3]; // deviceId or station

if (!stream || !['spout', 'kds'].includes(stream)) {
  console.error('Usage: node sse-example.js <spout|kds> [deviceId|station]');
  process.exit(1);
}

const url = new URL(`/stream/${stream}`, API_URL);
if (filter) {
  url.searchParams.set(stream === 'spout' ? 'deviceId' : 'station', filter);
}

console.log(`🔌 Connecting to ${url.href}...`);
console.log(`   Stream: ${stream}`);
if (filter) {
  console.log(`   Filter: ${filter}`);
}
console.log(`   Token: ${TOKEN.slice(0, 20)}...`);
console.log('');

const options = {
  method: 'GET',
  headers: {
    Authorization: `Bearer ${TOKEN}`,
    Accept: 'text/event-stream',
  },
};

const req = http.request(url, options, (res) => {
  console.log(`✅ Connected (${res.statusCode} ${res.statusMessage})`);
  console.log('');

  res.on('data', (chunk) => {
    const lines = chunk.toString().split('\n');
    for (const line of lines) {
      if (line.startsWith(': keepalive')) {
        console.log('💓 Keepalive ping');
      } else if (line.startsWith('data: ')) {
        const data = JSON.parse(line.slice(6));
        console.log(`📡 ${stream.toUpperCase()} event:`);
        console.log(JSON.stringify(data, null, 2));
        console.log('');
      }
    }
  });

  res.on('end', () => {
    console.log('');
    console.log('🔌 Connection closed by server');
  });

  res.on('error', (err) => {
    console.error('❌ Stream error:', err.message);
  });
});

req.on('error', (err) => {
  console.error('❌ Connection error:', err.message);
  console.error('');
  console.error('Troubleshooting:');
  console.error('  1. Is the API running? (cd services/api && pnpm dev)');
  console.error('  2. Is the token valid? (export L3_TOKEN=your-token)');
  console.error(`  3. Can you reach ${API_URL}/health?`);
  process.exit(1);
});

req.end();

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('');
  console.log('👋 Disconnecting...');
  req.destroy();
  process.exit(0);
});

console.log('📝 Press Ctrl+C to stop streaming');
console.log('');
