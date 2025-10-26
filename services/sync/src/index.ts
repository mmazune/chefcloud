// ChefCloud Sync Service
// Placeholder for ElectricSQL or RxDB replication bridge

import http from 'http';

const PORT = process.env.PORT || 3003;

const server = http.createServer((req, res) => {
  if (req.url === '/health' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        ok: true,
        service: 'sync',
        timestamp: new Date().toISOString(),
      }),
    );
  } else {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
  }
});

export const startSyncServer = () => {
  server.listen(PORT, () => {
    console.log('🔄 ChefCloud Sync Service online');
    console.log(`✅ Sync server running on http://localhost:${PORT}`);
    console.log('This service will handle offline-first sync with ElectricSQL or RxDB');
  });
};

if (require.main === module) {
  startSyncServer();
}

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down sync server...');
  server.close(() => {
    process.exit(0);
  });
});
