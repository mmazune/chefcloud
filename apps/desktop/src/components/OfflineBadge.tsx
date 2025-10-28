import { useState, useEffect } from 'react';
import { offlineQueue } from '../lib/offline-queue';
import { flushAll } from '../lib/api-wrapper';

export function OfflineBadge() {
  const [queueCount, setQueueCount] = useState(0);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncResult, setLastSyncResult] = useState<string>('');

  const updateQueueCount = async () => {
    const count = await offlineQueue.getCount();
    setQueueCount(count);
  };

  useEffect(() => {
    // Initial count
    void updateQueueCount();

    // Listen for online/offline events
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll queue count every 2 seconds
    const interval = setInterval(() => {
      void updateQueueCount();
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setLastSyncResult('');

    try {
      const result = await flushAll();
      if (result.flushed > 0) {
        setLastSyncResult(`✓ Synced ${result.flushed} ops`);
      }
      if (result.failed > 0) {
        setLastSyncResult(`⚠ ${result.failed} ops failed`);
      }
      await updateQueueCount();
    } catch (error) {
      setLastSyncResult(`✗ Sync error: ${(error as Error).message}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const status = !isOnline || queueCount > 0 ? 'offline' : 'online';
  const badgeColor = status === 'online' ? '#22c55e' : '#f59e0b';
  const badgeText = status === 'online' ? 'Online' : `Offline · ${queueCount}`;

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <span
        style={{
          backgroundColor: badgeColor,
          color: 'white',
          padding: '4px 12px',
          borderRadius: '12px',
          fontSize: '12px',
          fontWeight: 'bold',
        }}
      >
        {badgeText}
      </span>
      <button
        onClick={handleSync}
        disabled={queueCount === 0 || isSyncing}
        style={{
          padding: '4px 12px',
          borderRadius: '4px',
          border: '1px solid #ccc',
          backgroundColor: queueCount > 0 ? '#3b82f6' : '#e5e7eb',
          color: queueCount > 0 ? 'white' : '#9ca3af',
          cursor: queueCount > 0 ? 'pointer' : 'not-allowed',
          fontSize: '12px',
        }}
      >
        {isSyncing ? 'Syncing...' : 'Sync'}
      </button>
      {lastSyncResult && (
        <span style={{ fontSize: '12px', color: '#6b7280' }}>{lastSyncResult}</span>
      )}
    </div>
  );
}
