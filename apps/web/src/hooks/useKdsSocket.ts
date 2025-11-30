/**
 * M28-KDS-S3: WebSocket Hook for Real-Time KDS Updates
 * 
 * Connects to /kds WebSocket namespace and listens for order updates.
 * - Auto-connects on mount
 * - Provides connection status
 * - Calls onOrdersUpdated callback when server pushes updates
 * - Cleans up on unmount
 */

'use client';

import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import type { KdsOrder } from '@/types/pos';

interface UseKdsSocketOptions {
  onOrdersUpdated?: (orders: KdsOrder[]) => void;
}

interface UseKdsSocketResult {
  isConnected: boolean;
}

export function useKdsSocket(options: UseKdsSocketOptions = {}): UseKdsSocketResult {
  const { onOrdersUpdated } = options;
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Connect to KDS namespace
    const socket: Socket = io('/kds', {
      transports: ['websocket', 'polling'],
      autoConnect: true,
    });

    socket.on('connect', () => {
      setIsConnected(true);
      console.log('[useKdsSocket] Connected to KDS WebSocket');
    });

    socket.on('disconnect', () => {
      setIsConnected(false);
      console.log('[useKdsSocket] Disconnected from KDS WebSocket');
    });

    socket.on('kds:ordersUpdated', (orders: KdsOrder[]) => {
      console.log(`[useKdsSocket] Received ${orders.length} orders from server`);
      if (onOrdersUpdated) {
        onOrdersUpdated(orders);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('[useKdsSocket] Connection error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [onOrdersUpdated]);

  return { isConnected };
}
