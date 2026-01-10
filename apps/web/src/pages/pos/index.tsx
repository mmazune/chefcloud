import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AppShell } from '@/components/layout/AppShell';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useOfflineQueue } from '@/hooks/useOfflineQueue';
import { usePosCachedMenu } from '@/hooks/usePosCachedMenu';
import { usePosCachedOpenOrders } from '@/hooks/usePosCachedOpenOrders';
import { useOfflineStorageEstimate } from '@/hooks/useOfflineStorageEstimate';
import { clearPosSnapshots } from '@/lib/posIndexedDb';
import { PosSyncStatusPanel } from '@/components/pos/PosSyncStatusPanel';
import { PosSplitBillDrawer } from '@/components/pos/PosSplitBillDrawer';
import { KioskToggleButton } from '@/components/common/KioskToggleButton';
import { useDeviceRole } from '@/hooks/useDeviceRole';
import { DEVICE_ROLE_LABELS } from '@/types/deviceRole';
import { useAppUpdateBanner } from '@/hooks/useAppUpdateBanner';
import { APP_VERSION } from '@/version';
import { PosItemModifiersDrawer } from '@/components/pos/PosItemModifiersDrawer';
import { buildModifierSummary } from '@/lib/posModifiers';
import type { PosMenuItem } from '@/hooks/usePosCachedMenu';
import Link from 'next/link';
import type { PosSplitPaymentsDto, PosOrderLineModifier, PosOrderTabInfo } from '@/types/pos';
import { PosTabsSidebar } from '@/components/pos/PosTabsSidebar';
import { PosTabNameDialog } from '@/components/pos/PosTabNameDialog';
import { SystemDiagnosticsPanel } from '@/components/common/SystemDiagnosticsPanel';
import { DiagnosticsToggleButton } from '@/components/common/DiagnosticsToggleButton';
import { definePageMeta } from '@/lib/pageMeta';

/** Phase I2: Page metadata for action catalog */
export const pageMeta = definePageMeta({
  id: '/pos',
  title: 'POS - Point of Sale',
  primaryActions: [
    { label: 'New Order', testId: 'pos-new-order', intent: 'create' },
    { label: 'Add Item', testId: 'pos-add-item', intent: 'create' },
    { label: 'Send to Kitchen', testId: 'pos-send-kitchen', intent: 'update' },
    { label: 'Checkout', testId: 'pos-checkout', intent: 'navigate' },
    { label: 'Void Order', testId: 'pos-void-order', intent: 'delete' },
    { label: 'Split Bill', testId: 'pos-split-bill', intent: 'update' },
  ],
  apiCalls: [
    { method: 'GET', path: '/pos/open', trigger: 'onMount', notes: 'Fetch open orders' },
    { method: 'GET', path: '/pos/menu', trigger: 'onMount', notes: 'Fetch menu items' },
    { method: 'POST', path: '/pos/orders', trigger: 'onAction', notes: 'Create new order' },
    { method: 'POST', path: '/pos/orders/:id/lines', trigger: 'onAction', notes: 'Add item to order' },
    { method: 'POST', path: '/pos/orders/:id/send', trigger: 'onAction', notes: 'Send to kitchen' },
    { method: 'POST', path: '/pos/orders/:id/void', trigger: 'onAction', notes: 'Void order' },
  ],
  risk: 'HIGH',
  allowedRoles: ['OWNER', 'MANAGER', 'SUPERVISOR', 'CASHIER', 'WAITER', 'BARTENDER'],
});

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Order {
  id: string;
  tableName: string | null;
  tabName: string | null;
  status: string;
  subtotal: number;
  total: number;
  createdAt: string;
}

interface OrderDetail extends Order {
  items: OrderItem[];
  tax: number;
  payments: Payment[];
}

interface OrderItem {
  id: string;
  name: string;
  sku: string | null;
  quantity: number;
  unitPrice: number;
  total: number;
  status: string;
  notes: string | null;
  modifiers?: PosOrderLineModifier[]; // M26-EXT2: Applied modifiers
}

interface Payment {
  id: string;
  amount: number;
  method: string;
}

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-100 text-blue-800',
  SENT: 'bg-amber-100 text-amber-800',
  IN_KITCHEN: 'bg-orange-100 text-orange-800',
  READY: 'bg-green-100 text-green-800',
  SERVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  VOIDED: 'bg-red-100 text-red-800',
};

// M27-S1: Helper to generate idempotency keys
function generateIdempotencyKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export default function PosPage() {
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<'CASH' | 'CARD' | 'MOBILE'>('CASH');
  const [voidModalOpen, setVoidModalOpen] = useState(false);
  const [voidReason, setVoidReason] = useState('');
  // M26-EXT1: Split bill state
  const [activeSplitOrderId, setActiveSplitOrderId] = useState<string | null>(null);
  const [isSplitSubmitting, setIsSplitSubmitting] = useState(false);
  const [menuSearch, setMenuSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  const [isSyncPanelOpen, setIsSyncPanelOpen] = useState(false);
  
  // M26-EXT2: Modifier drawer state
  const [modifierDrawerOpen, setModifierDrawerOpen] = useState(false);
  const [modifierTarget, setModifierTarget] = useState<{
    orderId: string;
    lineId?: string;
    item: PosMenuItem;
    basePrice: number;
    existingModifiers?: PosOrderLineModifier[];
  } | null>(null);
  
  // M26-EXT3: Tabs management state
  const [tabsSidebarOpen, setTabsSidebarOpen] = useState(false);
  const [tabNameDialogOpen, setTabNameDialogOpen] = useState(false);
  const [tabNameDialogMode, setTabNameDialogMode] = useState<'create' | 'rename'>('create');
  const [tabNameDialogTarget, setTabNameDialogTarget] = useState<string | null>(null);
  
  // M30-OPS-S1: Diagnostics panel state
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  
  const queryClient = useQueryClient();

  // M29-PWA-S2: Device role for multi-device deployment
  const { role } = useDeviceRole();

  // M29-PWA-S3: App update detection
  const { hasUpdate, acknowledgeUpdate, reloadWithUpdate } = useAppUpdateBanner();

  // M27-S2: Register POS service worker on mount (now handled in useAppUpdateBanner)
  // useEffect(() => {
  //   registerPosServiceWorker();
  // }, []);

  // M27-S1 + M27-S2 + M27-S4 + M27-S6 + M27-S8: Offline queue for resilient POS operations with sync logging
  const { isOnline, isSyncing, queue, syncLog, addToQueue, syncQueue, clearQueue, clearSyncHistory } = useOfflineQueue();

  // M27-S4 + M27-S7: Derived sync status counts
  const queuedCount = queue.length;
  const failedCount = useMemo(
    () => syncLog.filter(entry => entry.status === 'failed').length,
    [syncLog]
  );
  const conflictCount = useMemo(
    () => syncLog.filter(entry => entry.status === 'conflict').length,
    [syncLog]
  );

  // M27-S3 + M27-S6: Cached open orders with offline support and staleness tracking
  const {
    openOrders: cachedOrders,
    isLoading: ordersLoading,
    source: ordersSource,
    isStale: openOrdersIsStale,
    ageMs: openOrdersAgeMs,
  } = usePosCachedOpenOrders();

  const orders = useMemo(() => cachedOrders ?? [], [cachedOrders]);

  // Fetch selected order details
  const { data: activeOrder, isLoading: orderLoading } = useQuery({
    queryKey: ['pos-order', selectedOrderId],
    queryFn: async () => {
      if (!selectedOrderId) return null;
      const res = await fetch(`${API_URL}/pos/orders/${selectedOrderId}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to fetch order');
      return res.json() as Promise<OrderDetail>;
    },
    enabled: !!selectedOrderId,
  });

  // M27-S1: Create new order with offline support
  const createOrderMutation = useMutation({
    mutationFn: async () => {
      const url = `${API_URL}/pos/orders`;
      const relativeUrl = '/pos/orders';
      const idempotencyKey = generateIdempotencyKey('pos-create');
      const body = {
        serviceType: 'DINE_IN',
        items: [],
      };

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body,
          idempotencyKey,
        });
        // Return mock response for offline mode
        return { id: `offline-${Date.now()}`, status: 'NEW' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to create order');
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      setSelectedOrderId(data.id);
    },
  });

  // M27-S1: Send to kitchen with offline support
  const sendToKitchenMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const url = `${API_URL}/pos/orders/${orderId}/send-to-kitchen`;
      const relativeUrl = `/pos/orders/${orderId}/send-to-kitchen`;
      const idempotencyKey = generateIdempotencyKey(`pos-send-${orderId}`);

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body: {},
          idempotencyKey,
        });
        return { status: 'SENT' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to send to kitchen');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pos-order', selectedOrderId] });
    },
  });

  // M27-S1: Close order (payment) with offline support
  const closeOrderMutation = useMutation({
    mutationFn: async ({ orderId, amount }: { orderId: string; amount: number }) => {
      const url = `${API_URL}/pos/orders/${orderId}/close`;
      const relativeUrl = `/pos/orders/${orderId}/close`;
      const idempotencyKey = generateIdempotencyKey(`pos-close-${orderId}`);
      const body = { amount, timestamp: new Date().toISOString() };

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body,
          idempotencyKey,
        });
        return { status: 'CLOSED' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to close order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pos-order', selectedOrderId] });
      setPaymentModalOpen(false);
      setSelectedOrderId(null);
    },
  });

  // M27-S1: Void order with offline support
  const voidOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      const url = `${API_URL}/pos/orders/${orderId}/void`;
      const relativeUrl = `/pos/orders/${orderId}/void`;
      const idempotencyKey = generateIdempotencyKey(`pos-void-${orderId}`);
      const body = { reason };

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body,
          idempotencyKey,
        });
        return { status: 'VOIDED' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error('Failed to void order');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      setVoidModalOpen(false);
      setSelectedOrderId(null);
    },
  });

  // M26-S2 + M27-S3 + M27-S6: Cached menu items with offline support and staleness tracking
  const {
    menu: cachedMenu,
    isLoading: menuLoading,
    source: menuSource,
    isStale: menuIsStale,
    ageMs: menuAgeMs,
  } = usePosCachedMenu();

  // M27-S6: Storage estimate for offline data
  const storageEstimate = useOfflineStorageEstimate();

  const menuItems = useMemo(() => cachedMenu ?? [], [cachedMenu]);

  // M26-S2: Derive category list
  const categories = useMemo(() => {
    const set = new Set<string>();
    menuItems.forEach((item) => {
      if (item.category?.name) set.add(item.category.name);
    });
    return Array.from(set).sort();
  }, [menuItems]);

  // M26-S2: Filter menu items
  const filteredMenuItems = useMemo(() => {
    return menuItems.filter((item) => {
      // Filter by active status
      if (item.isActive === false) return false;

      // Filter by category
      if (selectedCategory !== 'ALL' && item.category?.name !== selectedCategory) {
        return false;
      }

      // Filter by search
      if (!menuSearch.trim()) return true;

      const q = menuSearch.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        (item.sku && item.sku.toLowerCase().includes(q))
      );
    });
  }, [menuItems, selectedCategory, menuSearch]);

  // M26-S2/M27-S1: Add items to order mutation with offline support
  const addItemsMutation = useMutation({
    mutationFn: async (payload: { orderId: string; itemId: string }) => {
      const url = `${API_URL}/pos/orders/${payload.orderId}/modify`;
      const relativeUrl = `/pos/orders/${payload.orderId}/modify`;
      const idempotencyKey = generateIdempotencyKey(
        `pos-add-${payload.orderId}-${payload.itemId}`
      );
      const body = {
        items: [
          {
            menuItemId: payload.itemId,
            qty: 1,
          },
        ],
      };

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body,
          idempotencyKey,
        });
        return { status: 'queued' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error('Failed to add item');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pos-order', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
    },
  });

  // M26-S3/S4/M27-S1: Update item quantity and/or notes mutation with offline support
  const updateItemsMutation = useMutation({
    mutationFn: async (payload: {
      orderId: string;
      itemId: string;
      quantity?: number;
      notes?: string;
    }) => {
      const url = `${API_URL}/pos/orders/${payload.orderId}/modify`;
      const relativeUrl = `/pos/orders/${payload.orderId}/modify`;
      const idempotencyKey = generateIdempotencyKey(
        `pos-update-${payload.orderId}-${payload.itemId}`
      );
      const body: any = {
        updateItems: [
          {
            orderItemId: payload.itemId,
          },
        ],
      };

      if (typeof payload.quantity === 'number') {
        body.updateItems[0].quantity = payload.quantity;
      }
      if (typeof payload.notes === 'string') {
        body.updateItems[0].notes = payload.notes;
      }

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body,
          idempotencyKey,
        });
        return { status: 'queued' };
      }

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        throw new Error('Failed to update item');
      }
      return res.json();
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['pos-order', variables.orderId] });
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
    },
  });

  // M26-S3/S4: Determine if order items can be edited
  const canEditOrderItems =
    activeOrder &&
    (activeOrder.status === 'NEW' ||
      activeOrder.status === 'SENT' ||
      activeOrder.status === 'IN_PROGRESS');

  // M26-S3/S4: Get selected item details
  const selectedItem =
    activeOrder?.items?.find((item) => item.id === selectedItemId) ?? null;

  // M26-S3: Quantity control handlers
  const handleIncreaseQuantity = (item: OrderItem) => {
    if (!selectedOrderId) return;
    updateItemsMutation.mutate({
      orderId: selectedOrderId,
      itemId: item.id,
      quantity: item.quantity + 1,
    });
  };

  const handleDecreaseQuantity = (item: OrderItem) => {
    if (!selectedOrderId) return;
    const nextQty = item.quantity - 1;
    if (nextQty <= 0) {
      // Treat as remove - ask for confirmation
      if (confirm(`Remove ${item.name} from the order?`)) {
        updateItemsMutation.mutate({
          orderId: selectedOrderId,
          itemId: item.id,
          quantity: 0,
        });
      }
    } else {
      updateItemsMutation.mutate({
        orderId: selectedOrderId,
        itemId: item.id,
        quantity: nextQty,
      });
    }
  };

  const handleRemoveItem = (item: OrderItem) => {
    if (!selectedOrderId) return;
    if (!confirm(`Remove ${item.name} from the order?`)) return;

    updateItemsMutation.mutate({
      orderId: selectedOrderId,
      itemId: item.id,
      quantity: 0,
    });
  };

  // M26-S2: Handle adding menu item to order
  const handleAddItemClick = (item: PosMenuItem) => {
    if (!selectedOrderId) {
      alert('Please create or select an order first.');
      return;
    }

    // M26-EXT2: Open modifier drawer if item has modifier groups
    if (item.modifierGroups && item.modifierGroups.length > 0) {
      setModifierTarget({
        orderId: selectedOrderId,
        item,
        basePrice: item.price,
        existingModifiers: [],
      });
      setModifierDrawerOpen(true);
      return;
    }

    // No modifiers - quick add
    addItemsMutation.mutate({ orderId: selectedOrderId, itemId: item.id });
  };

  const handleOpenPayment = () => {
    if (!activeOrder) return;
    const totalPaid = activeOrder.payments.reduce((sum, p) => sum + p.amount, 0);
    const balance = activeOrder.total - totalPaid;
    setPaymentAmount(balance);
    setPaymentModalOpen(true);
  };

  // M27-S6: Cache management handlers
  const handleClearSnapshots = async () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'This will remove cached menu and open orders on this device. Live data will still load when online. Continue?'
      );
      if (!ok) return;
    }
    await clearPosSnapshots(); // Clear all snapshots (no keys = clear all)
    // Reload page to refresh hooks
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  const handleClearQueue = () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'This will remove all pending offline POS actions on this device. Unsynced changes will be lost. Continue?'
      );
      if (!ok) return;
    }
    clearQueue();
  };

  // M27-S8: Clear sync history handler
  const handleClearSyncHistory = () => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'This will remove all recorded sync history on this device. Pending actions and cached data will not be affected. Continue?'
      );
      if (!ok) return;
    }
    clearSyncHistory();
  };

  const handleConfirmPayment = () => {
    if (!selectedOrderId) return;
    closeOrderMutation.mutate({ orderId: selectedOrderId, amount: paymentAmount });
  };

  const handleOpenVoid = () => {
    setVoidReason('');
    setVoidModalOpen(true);
  };

  const handleConfirmVoid = () => {
    if (!selectedOrderId || !voidReason.trim()) return;
    voidOrderMutation.mutate({ orderId: selectedOrderId, reason: voidReason });
  };

  // M26-EXT3: Derive tab info from open orders
  const openTabs = useMemo<PosOrderTabInfo[]>(() => {
    return orders
      .filter(order => order.status !== 'CLOSED' && order.status !== 'VOIDED')
      .map(order => ({
        orderId: order.id,
        tabName: order.tabName || null,
        serviceType: 'DINE_IN', // Default - backend should provide this
        tableLabel: order.tableName || null,
        guestCount: null, // Not available in order list
        createdAt: order.createdAt,
        lastModifiedAt: order.createdAt,
        itemCount: 0, // Not available in order list
        orderTotal: order.total,
        status: 'OPEN' as const,
      }));
  }, [orders]);

  // M26-EXT3: Tab management handlers
  const handleResumeTab = (tabId: string) => {
    setSelectedOrderId(tabId);
  };

  const handleRenameTab = (tabId: string) => {
    setTabNameDialogMode('rename');
    setTabNameDialogTarget(tabId);
    setTabNameDialogOpen(true);
  };

  const handleDetachTab = (tabId: string) => {
    if (typeof window !== 'undefined') {
      const ok = window.confirm(
        'Close this tab without payment? The order will be voided.'
      );
      if (!ok) return;
    }
    voidOrderMutation.mutate({ orderId: tabId, reason: 'Tab detached' });
  };

  const handleTabNameConfirm = (tabName: string) => {
    if (!tabNameDialogTarget) return;

    // Update tab name via offline queue
    const orderId = tabNameDialogTarget;
    const url = `${API_URL}/pos/orders/${orderId}/tab-name`;
    const relativeUrl = `/pos/orders/${orderId}/tab-name`;
    const idempotencyKey = generateIdempotencyKey(`pos-update-tab-${orderId}`);
    const body = { tabName };

    if (!isOnline) {
      addToQueue({
        url: relativeUrl,
        method: 'PATCH',
        body,
        idempotencyKey,
      });
      // Optimistically update local cache
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
    } else {
      fetch(url, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(body),
      })
        .then(res => {
          if (!res.ok) throw new Error('Failed to update tab name');
          return res.json();
        })
        .then(() => {
          queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
        })
        .catch(err => {
          console.error('Update tab name failed:', err);
        });
    }

    setTabNameDialogOpen(false);
    setTabNameDialogTarget(null);
  };

  // M26-EXT2: Handle modifier confirmation
  const handleModifierConfirm = (modifiers: PosOrderLineModifier[], _totalPrice: number) => {
    if (!modifierTarget) return;

    const { orderId, lineId, item } = modifierTarget;

    if (lineId) {
      // Editing existing line - update modifiers (will be handled by offline queue)
      // For now, just add as a new item since backend update endpoint may not exist yet
      alert('Modifier editing not yet implemented. Please add as new item.');
    } else {
      // Adding new item with modifiers
      const url = `${API_URL}/pos/orders/${orderId}/items`;
      const relativeUrl = `/pos/orders/${orderId}/items`;
      const idempotencyKey = generateIdempotencyKey(`pos-add-item-${orderId}-${item.id}`);

      const body = {
        itemId: item.id,
        quantity: 1,
        modifiers: modifiers.map(m => ({
          groupId: m.groupId,
          optionId: m.optionId,
          priceDelta: m.priceDelta,
        })),
      };

      if (!isOnline) {
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body,
          idempotencyKey,
        });
      } else {
        fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Idempotency-Key': idempotencyKey,
          },
          credentials: 'include',
          body: JSON.stringify(body),
        })
          .then(res => {
            if (!res.ok) throw new Error('Failed to add item');
            return res.json();
          })
          .then(() => {
            queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
          })
          .catch(err => {
            console.error('Add item with modifiers failed:', err);
          });
      }
    }

    setModifierDrawerOpen(false);
    setModifierTarget(null);
  };

  // M26-EXT1: Handle split bill submission with offline queue support
  const handleSubmitSplit = async (orderId: string, payload: PosSplitPaymentsDto) => {
    setIsSplitSubmitting(true);
    try {
      const url = `${API_URL}/pos/orders/${orderId}/split-payments`;
      const relativeUrl = `/pos/orders/${orderId}/split-payments`;
      const idempotencyKey = generateIdempotencyKey(`pos-split-${orderId}`);

      if (!isOnline) {
        // Queue for background sync using existing offlineQueue infra
        addToQueue({
          url: relativeUrl,
          method: 'POST',
          body: payload,
          idempotencyKey,
        });
        // Optimistically close drawer and refresh order list
        queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
        queryClient.invalidateQueries({ queryKey: ['pos-order', orderId] });
        setActiveSplitOrderId(null);
        return;
      }

      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Idempotency-Key': idempotencyKey,
        },
        credentials: 'include',
        body: JSON.stringify(payload),
      });

      if (!resp.ok) {
        const text = await resp.text();
        throw new Error(text || `Split payments failed: ${resp.status}`);
      }

      // Success - refresh order data
      queryClient.invalidateQueries({ queryKey: ['pos-open-orders'] });
      queryClient.invalidateQueries({ queryKey: ['pos-order', orderId] });
      setActiveSplitOrderId(null);
    } finally {
      setIsSplitSubmitting(false);
    }
  };

  const totalPaid = activeOrder?.payments.reduce((sum, p) => sum + p.amount, 0) || 0;
  const balance = activeOrder ? activeOrder.total - totalPaid : 0;

  return (
    <AppShell>
      <PageHeader
        title="POS – Dining Room"
        subtitle="Create orders, send to kitchen, and process payments"
        actions={
          <div className="flex items-center gap-2">
            <Link
              href="/launch"
              className="text-[10px] text-slate-400 hover:text-slate-200 flex items-center gap-1 border border-slate-700 rounded-full px-2 py-0.5 bg-slate-900/60"
            >
              Device: {DEVICE_ROLE_LABELS[role]}
            </Link>
            <KioskToggleButton size="sm" />
            <DiagnosticsToggleButton onClick={() => setDiagnosticsOpen(true)} />
          </div>
        }
      />

      {/* M29-PWA-S3: App update banner */}
      {hasUpdate && (
        <div className="flex items-center justify-between gap-3 border-b border-amber-500/40 bg-amber-500/10 px-3 py-1.5 text-[11px] text-amber-100">
          <div>
            <span className="font-medium">New ChefCloud version available.</span>{' '}
            <span className="text-amber-200/80">
              Current: {APP_VERSION}. Reload to apply updates.
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={acknowledgeUpdate}
              className="rounded-md border border-amber-400/60 px-2 py-0.5 text-[10px] text-amber-100 hover:bg-amber-500/20"
            >
              Dismiss
            </button>
            <button
              type="button"
              onClick={() => void reloadWithUpdate()}
              className="rounded-md bg-amber-400 px-3 py-1 text-[10px] font-semibold text-slate-900 hover:bg-amber-300"
            >
              Reload now
            </button>
          </div>
        </div>
      )}

      {/* M27-S1 + M27-S2 + M27-S4 + M27-S7: Enhanced Offline/Online Banner */}
      {!isOnline && (
        <div className="mb-3 rounded-md bg-amber-100 border border-amber-300 px-3 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-amber-900">
            <span>You are currently offline. New actions will be queued and sent when you&apos;re back online.</span>
            {queuedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 border border-amber-300 px-2 py-0.5 text-[10px] font-semibold uppercase">
                Queued: {queuedCount}
              </span>
            )}
            {failedCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-100 border border-red-300 px-2 py-0.5 text-[10px] font-semibold uppercase text-red-800">
                Failed: {failedCount}
              </span>
            )}
            {conflictCount > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 border border-orange-300 px-2 py-0.5 text-[10px] font-semibold uppercase text-orange-800">
                Conflicts: {conflictCount}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-6 px-2"
              onClick={() => setIsSyncPanelOpen(true)}
            >
              View sync details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-6 px-2"
              onClick={() => syncQueue()}
              disabled={queue.length === 0 || isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
          </div>
        </div>
      )}

      {isOnline && queue.length > 0 && (
        <div className="mb-3 rounded-md bg-blue-50 border border-blue-200 px-3 py-2 flex items-center justify-between">
          <div className="text-xs text-blue-900">
            {isSyncing ? 'Syncing pending actions...' : `You're back online. There are ${queue.length} pending actions.`}
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-6 px-2"
              onClick={() => setIsSyncPanelOpen(true)}
            >
              View details
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="text-[11px] h-6 px-2"
              onClick={() => syncQueue()}
              disabled={isSyncing}
            >
              {isSyncing ? 'Syncing...' : 'Sync now'}
            </Button>
          </div>
        </div>
      )}

      {/* M27-S4 + M27-S7: Failed/Conflict actions warning when online */}
      {isOnline && queue.length === 0 && failedCount > 0 && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2 flex items-center justify-between">
          <div className="text-xs text-red-900">
            Some offline actions failed to sync. Review details and retry when ready.
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-6 px-2"
            onClick={() => setIsSyncPanelOpen(true)}
          >
            View sync details
          </Button>
        </div>
      )}

      {/* M27-S7: Conflict actions warning when online */}
      {isOnline && queue.length === 0 && conflictCount > 0 && (
        <div className="mb-3 rounded-md bg-orange-50 border border-orange-200 px-3 py-2 flex items-center justify-between">
          <div className="text-xs text-orange-900">
            Some offline actions were skipped because the order changed on another device. Review details for more information.
          </div>
          <Button
            size="sm"
            variant="outline"
            className="text-[11px] h-6 px-2"
            onClick={() => setIsSyncPanelOpen(true)}
          >
            View sync details
          </Button>
        </div>
      )}

      {/* M27-S3 + M27-S6: Cache status banners with staleness warnings */}
      {!isOnline && (menuSource === 'cache' || ordersSource === 'cache') && (
        <div className="mb-3 rounded-md bg-amber-50 border border-amber-200 px-3 py-2">
          <div className="text-xs text-amber-900">
            Showing last-known POS data from this device. Some changes may not be reflected until you&apos;re back online.
            {(menuIsStale || openOrdersIsStale) && (
              <span className="ml-2 font-semibold">
                Note: some cached data is old; connect soon to refresh.
              </span>
            )}
          </div>
        </div>
      )}

      {!isOnline && menuSource === 'none' && ordersSource === 'none' && (
        <div className="mb-3 rounded-md bg-red-50 border border-red-200 px-3 py-2">
          <div className="text-xs text-red-900">
            No cached POS data available. Connect to the internet at least once to enable offline mode.
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Order List */}
        <Card className="lg:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">Open Orders</h3>
              {/* M26-EXT3: Tabs button */}
              {openTabs.length > 0 && (
                <button
                  onClick={() => setTabsSidebarOpen(true)}
                  className="flex items-center gap-1 rounded-lg border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors"
                  aria-label="Open tabs sidebar"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Tabs ({openTabs.length})
                </button>
              )}
            </div>
            <Button
              variant="default"
              size="sm"
              onClick={() => createOrderMutation.mutate()}
              disabled={createOrderMutation.isPending}
              data-testid="pos-new-order"
            >
              New Order
            </Button>
          </div>

          {ordersLoading && <p className="text-sm text-gray-500">Loading...</p>}

          {!ordersLoading && orders.length === 0 && (
            <p className="text-sm text-gray-500">No open orders</p>
          )}

          {!ordersLoading && orders.length > 0 && (
            <div className="space-y-2">
              {orders.map((order) => (
                <button
                  key={order.id}
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`w-full text-left p-3 border rounded-lg transition-colors ${
                    selectedOrderId === order.id
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium">
                      {order.tableName || order.tabName || 'Walk-in'}
                    </span>
                    <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[order.status] || 'bg-gray-100'}`}>
                      {order.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm text-gray-600">
                    <span>UGX {order.total.toLocaleString()}</span>
                    <span>{new Date(order.createdAt).toLocaleTimeString()}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        {/* Center: Active Order */}
        <Card className="lg:col-span-1">
          <h3 className="text-lg font-semibold mb-4">Active Order</h3>

          {!selectedOrderId && (
            <p className="text-sm text-gray-500">Select an order or create a new one</p>
          )}

          {selectedOrderId && orderLoading && (
            <p className="text-sm text-gray-500">Loading...</p>
          )}

          {selectedOrderId && !orderLoading && activeOrder && (
            <div>
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium">
                    {activeOrder.tableName || activeOrder.tabName || 'Walk-in'}
                  </span>
                  <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[activeOrder.status] || 'bg-gray-100'}`}>
                    {activeOrder.status}
                  </span>
                </div>
              </div>

              {/* Items - M26-S3/S4: Enhanced with quantity controls */}
              <div className="border-t border-b py-3 mb-3">
                {activeOrder.items.length === 0 && (
                  <p className="text-sm text-gray-500">No items yet</p>
                )}
                {!canEditOrderItems && activeOrder.items.length > 0 && (
                  <p className="text-xs text-amber-600 mb-2">
                    Items locked once order is sent to kitchen or ready.
                  </p>
                )}
                <div className="space-y-2">
                  {activeOrder.items.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItemId(item.id)}
                      className={`flex items-center gap-3 py-2 border-b last:border-b-0 cursor-pointer rounded px-1 transition-colors ${
                        selectedItemId === item.id
                          ? 'bg-blue-50 border-blue-200'
                          : 'hover:bg-gray-50'
                      }`}
                    >
                      {/* Item info */}
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">{item.name}</div>
                        <div className="text-xs text-gray-600">
                          UGX {item.unitPrice.toLocaleString()} each
                        </div>
                        {/* M26-EXT2: Modifier summary */}
                        {item.modifiers && item.modifiers.length > 0 && (
                          <div className="text-xs text-emerald-600 mt-1">
                            🔧 {buildModifierSummary(item.modifiers)}
                          </div>
                        )}
                        {item.notes && (
                          <div className="text-xs text-blue-600 mt-1 italic">
                            📝 {item.notes}
                          </div>
                        )}
                      </div>

                      {/* Quantity controls */}
                      {canEditOrderItems ? (
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDecreaseQuantity(item);
                            }}
                            disabled={updateItemsMutation.isPending}
                          >
                            −
                          </Button>
                          <span className="px-2 text-sm font-medium min-w-[2rem] text-center">
                            {item.quantity}
                          </span>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 w-7 p-0"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleIncreaseQuantity(item);
                            }}
                            disabled={updateItemsMutation.isPending}
                          >
                            +
                          </Button>
                        </div>
                      ) : (
                        <div className="px-2 text-sm font-medium">× {item.quantity}</div>
                      )}

                      {/* Total */}
                      <div className="text-right min-w-[80px]">
                        <div className="font-medium text-sm">
                          UGX {item.total.toLocaleString()}
                        </div>
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[item.status] || 'bg-gray-100'}`}
                        >
                          {item.status}
                        </span>
                      </div>

                      {/* Remove button */}
                      {canEditOrderItems && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-red-600"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveItem(item);
                          }}
                          disabled={updateItemsMutation.isPending}
                        >
                          🗑
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Subtotal</span>
                  <span>UGX {activeOrder.subtotal.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Tax</span>
                  <span>UGX {activeOrder.tax.toLocaleString()}</span>
                </div>
                <div className="flex justify-between font-semibold text-lg border-t pt-2">
                  <span>Total</span>
                  <span>UGX {activeOrder.total.toLocaleString()}</span>
                </div>
                {totalPaid > 0 && (
                  <>
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Paid</span>
                      <span>-UGX {totalPaid.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between font-semibold">
                      <span>Balance</span>
                      <span>UGX {balance.toLocaleString()}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="space-y-2">
                {activeOrder.status === 'NEW' && (
                  <Button
                    variant="default"
                    className="w-full"
                    onClick={() => sendToKitchenMutation.mutate(activeOrder.id)}
                    disabled={sendToKitchenMutation.isPending || activeOrder.items.length === 0}
                    data-testid="pos-send-kitchen"
                  >
                    Send to Kitchen
                  </Button>
                )}

                {['SENT', 'IN_KITCHEN', 'READY', 'SERVED'].includes(activeOrder.status) && balance > 0 && (
                  <>
                    <Button
                      variant="default"
                      className="w-full"
                      onClick={handleOpenPayment}
                      data-testid="pos-checkout"
                    >
                      Take Payment
                    </Button>
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => setActiveSplitOrderId(activeOrder.id)}
                      data-testid="pos-split-bill"
                    >
                      Split Bill
                    </Button>
                  </>
                )}

                {['NEW', 'SENT'].includes(activeOrder.status) && (
                  <Button
                    variant="secondary"
                    className="w-full"
                    onClick={handleOpenVoid}
                    data-testid="pos-void-order"
                  >
                    Void Order
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* M26-S4: Modifiers & Notes Panel */}
          {selectedItem && selectedOrderId && (
            <div className="mt-4">
              <Card>
                <div className="p-4 border-b flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-semibold">
                      Modifiers & notes for: {selectedItem.name}
                    </h3>
                    <p className="text-xs text-muted-foreground">
                      These instructions are sent to the kitchen.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setSelectedItemId(null)}
                    className="h-6 w-6 p-0"
                  >
                    ✕
                  </Button>
                </div>
                <div className="p-4 space-y-4">
                  {/* Quick modifiers */}
                  <div>
                    <div className="text-xs font-medium mb-2">Quick modifiers</div>
                    <div className="flex flex-wrap gap-2">
                      {[
                        'No onions',
                        'Extra spicy',
                        'Less salt',
                        'No cheese',
                        'Well done',
                      ].map((label) => (
                        <Button
                          key={label}
                          size="sm"
                          variant="outline"
                          className="text-xs"
                          disabled={
                            updateItemsMutation.isPending || !canEditOrderItems
                          }
                          onClick={() => {
                            const existing = (selectedItem.notes ?? '').trim();
                            const next = existing
                              ? `${existing}; ${label}`
                              : label;
                            updateItemsMutation.mutate({
                              orderId: selectedOrderId,
                              itemId: selectedItem.id,
                              notes: next,
                            });
                          }}
                        >
                          {label}
                        </Button>
                      ))}
                    </div>
                  </div>

                  {/* Free-text notes */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-medium">
                        Special instructions
                      </label>
                      <span className="text-[10px] text-muted-foreground">
                        Max ~200 characters
                      </span>
                    </div>
                    <textarea
                      className="w-full min-h-[80px] text-sm border rounded-md px-2 py-1 bg-background"
                      defaultValue={selectedItem.notes ?? ''}
                      disabled={
                        updateItemsMutation.isPending || !canEditOrderItems
                      }
                      onBlur={(e) => {
                        const value = e.target.value.trim();
                        updateItemsMutation.mutate({
                          orderId: selectedOrderId,
                          itemId: selectedItem.id,
                          notes: value || '',
                        });
                      }}
                      maxLength={200}
                    />
                    <p className="mt-1 text-[10px] text-muted-foreground">
                      Example: &ldquo;Birthday cake, bring with sparkler at dessert.&rdquo;
                    </p>
                  </div>

                  {!canEditOrderItems && (
                    <p className="mt-2 text-xs text-amber-600">
                      Items are locked because this order is{' '}
                      {activeOrder?.status.toLowerCase()}.
                    </p>
                  )}
                </div>
              </Card>
            </div>
          )}
        </Card>

        {/* Right: Menu Browser (M26-S2) */}
        <Card className="lg:col-span-1 flex flex-col h-full">
          <div className="p-4 border-b">
            <h3 className="text-lg font-semibold mb-1">Menu</h3>
            <p className="text-sm text-muted-foreground">
              Tap items to add them to the active order.
            </p>

            <div className="mt-3 space-y-2">
              <Input
                placeholder="Search menu..."
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
              />
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant={selectedCategory === 'ALL' ? 'default' : 'outline'}
                  onClick={() => setSelectedCategory('ALL')}
                >
                  All
                </Button>
                {categories.map((cat) => (
                  <Button
                    key={cat}
                    size="sm"
                    variant={selectedCategory === cat ? 'default' : 'outline'}
                    onClick={() => setSelectedCategory(cat)}
                  >
                    {cat}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 grid gap-2 grid-cols-2">
            {menuLoading ? (
              <div className="col-span-2 text-center text-sm text-muted-foreground py-4">
                Loading menu...
              </div>
            ) : filteredMenuItems.length === 0 ? (
              <div className="col-span-2 text-center text-sm text-muted-foreground py-4">
                No items match your filters.
              </div>
            ) : (
              filteredMenuItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleAddItemClick(item)}
                  disabled={addItemsMutation.isPending}
                  className="text-left rounded-lg border p-3 hover:bg-muted transition disabled:opacity-50"
                >
                  <div className="font-medium truncate text-sm">{item.name}</div>
                  {item.sku && (
                    <div className="text-xs text-muted-foreground truncate mt-0.5">
                      {item.sku}
                    </div>
                  )}
                  <div className="mt-2 text-sm font-semibold">
                    UGX {item.price.toLocaleString()}
                  </div>
                </button>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Payment Modal */}
      {paymentModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Take Payment</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(Number(e.target.value))}
                  min={0}
                  step={0.01}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <div className="space-y-2">
                  {(['CASH', 'CARD', 'MOBILE'] as const).map((method) => (
                    <label key={method} className="flex items-center">
                      <input
                        type="radio"
                        value={method}
                        checked={paymentMethod === method}
                        onChange={(e) => setPaymentMethod(e.target.value as any)}
                        className="mr-2"
                      />
                      <span>{method}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="default"
                  className="flex-1"
                  onClick={handleConfirmPayment}
                  disabled={closeOrderMutation.isPending || paymentAmount <= 0}
                >
                  Confirm Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Void Modal */}
      {voidModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold mb-4">Void Order</h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Reason
                </label>
                <textarea
                  value={voidReason}
                  onChange={(e) => setVoidReason(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  rows={3}
                  placeholder="e.g. Customer cancelled"
                />
              </div>

              <div className="flex space-x-3 pt-4">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setVoidModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleConfirmVoid}
                  disabled={voidOrderMutation.isPending || !voidReason.trim()}
                >
                  Confirm Void
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* M27-S4 + M27-S6 + M27-S8: Sync Status Panel with cache management and persistent sync history */}
      <PosSyncStatusPanel
        isOpen={isSyncPanelOpen}
        onClose={() => setIsSyncPanelOpen(false)}
        isSyncing={isSyncing}
        syncLog={syncLog}
        onRetryAll={syncQueue}
        onClearSnapshots={handleClearSnapshots}
        onClearQueue={handleClearQueue}
        onClearSyncHistory={handleClearSyncHistory}
        menuAgeMs={menuAgeMs}
        menuIsStale={menuIsStale}
        openOrdersAgeMs={openOrdersAgeMs}
        openOrdersIsStale={openOrdersIsStale}
        storageEstimate={storageEstimate}
      />

      {/* M26-EXT1: Split Bill Drawer */}
      {activeSplitOrderId && activeOrder && (
        <PosSplitBillDrawer
          isOpen={true}
          onClose={() => setActiveSplitOrderId(null)}
          orderId={activeSplitOrderId}
          orderTotal={activeOrder.total}
          currency="UGX"
          isSubmitting={isSplitSubmitting}
          onSubmitSplit={payload => handleSubmitSplit(activeSplitOrderId, payload)}
        />
      )}

      {/* M26-EXT2: Modifier Configuration Drawer */}
      {modifierTarget && (
        <PosItemModifiersDrawer
          open={modifierDrawerOpen}
          onClose={() => {
            setModifierDrawerOpen(false);
            setModifierTarget(null);
          }}
          item={modifierTarget.item}
          existingModifiers={modifierTarget.existingModifiers}
          basePrice={modifierTarget.basePrice}
          onConfirm={handleModifierConfirm}
        />
      )}

      {/* M26-EXT3: Tabs Sidebar */}
      <PosTabsSidebar
        open={tabsSidebarOpen}
        onClose={() => setTabsSidebarOpen(false)}
        tabs={openTabs}
        activeTabId={selectedOrderId}
        onResumeTab={handleResumeTab}
        onRenameTab={handleRenameTab}
        onDetachTab={handleDetachTab}
      />

      {/* M26-EXT3: Tab Name Dialog */}
      <PosTabNameDialog
        open={tabNameDialogOpen}
        onClose={() => {
          setTabNameDialogOpen(false);
          setTabNameDialogTarget(null);
        }}
        mode={tabNameDialogMode}
        currentName={
          tabNameDialogTarget
            ? openTabs.find(t => t.orderId === tabNameDialogTarget)?.tabName || null
            : null
        }
        onConfirm={handleTabNameConfirm}
      />

      {/* M30-OPS-S1: System Diagnostics Panel */}
      <SystemDiagnosticsPanel
        open={diagnosticsOpen}
        onClose={() => setDiagnosticsOpen(false)}
        context="POS"
      />
    </AppShell>
  );
}
