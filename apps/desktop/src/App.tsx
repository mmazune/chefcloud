import { useState, useEffect } from 'react';
import { colors } from '@chefcloud/ui';
import { IdleScreensaver } from './components/IdleScreensaver';
import { OfflineBadge } from './components/OfflineBadge';
import { testPrint } from './lib/printer-client';
import { offlineQueue, QueuedOp } from './lib/offline-queue';
import { sendOrQueue } from './lib/api-wrapper';
import { newId } from './lib/ids';
import { startMsrListener, stopMsrListener } from './lib/msr';
import { parseMsrSwipe } from './lib/msr-parse';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

function App() {
  const [count, setCount] = useState(0);
  const [lastResult, setLastResult] = useState<string>('');
  const [demoOrderId, setDemoOrderId] = useState<string>('');
  const [msrEnabled, setMsrEnabled] = useState(false);

  // Get timeout from env or default to 120000ms (120s)
  const idleTimeout = 120000; // Configurable via env in production

  // MSR listener effect
  useEffect(() => {
    if (msrEnabled) {
      startMsrListener(async (raw) => {
        const parsed = parseMsrSwipe(raw);

        if (parsed.type === 'rejected') {
          setLastResult(`🚫 ${parsed.reason}`);
          return;
        }

        // Attempt badge login
        try {
          const res = await fetch(`${API_BASE_URL}/auth/msr-swipe`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ trackData: `CLOUDBADGE:${parsed.code}` }),
          });

          if (!res.ok) {
            const err = await res.json();
            setLastResult(`❌ Badge login failed: ${err.message || res.statusText}`);
            return;
          }

          const data = await res.json();
          localStorage.setItem('authToken', data.token);
          setLastResult(`✅ Badge login: ${data.user.email}`);
        } catch (error) {
          setLastResult(`❌ Badge login error: ${(error as Error).message}`);
        }
      });
    } else {
      stopMsrListener();
    }

    return () => stopMsrListener();
  }, [msrEnabled]);

  const handleCreateDemoOrder = async () => {
    const clientOrderId = newId();
    const clientOpId = newId();

    const op: QueuedOp = {
      clientOpId,
      type: 'CREATE_ORDER',
      clientOrderId,
      payload: {
        tableId: 'demo-table-1',
        serviceType: 'DINE_IN',
        items: [
          { menuItemId: 'burger-id', qty: 1 },
          { menuItemId: 'fries-id', qty: 1 },
        ],
      },
      at: new Date().toISOString(),
    };

    const result = await sendOrQueue(op, offlineQueue);
    setDemoOrderId(clientOrderId);

    if (result.queued) {
      setLastResult(`⏳ Order queued for sync (${result.error || 'offline'})`);
    } else {
      setLastResult(`✓ Order created: ${result.result?.serverId || clientOrderId}`);
    }
  };

  const handleCloseDemoOrder = async () => {
    if (!demoOrderId) {
      setLastResult('⚠ Create an order first');
      return;
    }

    const clientOpId = newId();

    const op: QueuedOp = {
      clientOpId,
      type: 'CLOSE_ORDER',
      clientOrderId: demoOrderId,
      payload: {
        orderId: demoOrderId,
        amount: 25000,
      },
      at: new Date().toISOString(),
    };

    const result = await sendOrQueue(op, offlineQueue);

    if (result.queued) {
      setLastResult(`⏳ Close order queued for sync (${result.error || 'offline'})`);
    } else {
      setLastResult(`✓ Order closed successfully`);
    }
  };

  return (
    <>
      <IdleScreensaver timeout={idleTimeout} />
      <div className="container">
        <div
          style={{
            position: 'absolute',
            top: '10px',
            right: '10px',
            display: 'flex',
            gap: '10px',
            alignItems: 'center',
          }}
        >
          <div
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              fontSize: '12px',
              backgroundColor: msrEnabled ? '#28a745' : '#ccc',
              color: 'white',
            }}
          >
            MSR: {msrEnabled ? 'Listening' : 'Off'}
          </div>
          <OfflineBadge />
        </div>

        <h1>Hello ChefCloud</h1>
        <p style={{ color: colors.chefBlue }}>Desktop POS Terminal - Offline-first architecture</p>

        <div className="card">
          <h3>Demo Actions (Offline-Capable)</h3>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '10px' }}>
            <button onClick={handleCreateDemoOrder}>Create Demo Order (Burger + Fries)</button>
            <button onClick={handleCloseDemoOrder} disabled={!demoOrderId}>
              Close Demo Order
            </button>
            <button onClick={testPrint}>Test Print</button>
            <button onClick={() => setMsrEnabled(!msrEnabled)}>
              {msrEnabled ? '⏸ Disable MSR' : '▶ Enable MSR'}
            </button>
          </div>

          {lastResult && (
            <div
              style={{
                padding: '8px',
                backgroundColor: '#f3f4f6',
                borderRadius: '4px',
                fontSize: '14px',
                marginTop: '10px',
              }}
            >
              {lastResult}
            </div>
          )}

          <hr style={{ margin: '20px 0' }} />
          <button onClick={() => setCount((count) => count + 1)}>count is {count}</button>
        </div>

        <p className="version">v0.1.0</p>
      </div>
    </>
  );
}

export default App;
