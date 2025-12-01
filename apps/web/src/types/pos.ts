/**
 * M26-EXT1: POS Frontend Type Definitions
 * 
 * Provides type safety for POS operations including split payments.
 * These types align with backend DTOs from services/api.
 */

/**
 * Payment method types supported by the POS system
 */
export type PaymentMethod = 'CASH' | 'CARD' | 'MOBILE';

/**
 * Individual payment DTO matching backend PaymentDto structure
 */
export interface PosPaymentDto {
  method: PaymentMethod;
  amount: number;       // Amount in base currency (minor units or decimal based on convention)
  tipAmount?: number;   // Optional tip amount
  reference?: string | null;  // Optional payment reference (e.g., card transaction ID)
}

/**
 * Split payments DTO for sending multiple payments to backend
 * Used with POST /api/pos/orders/:id/split-payments endpoint
 */
export interface PosSplitPaymentsDto {
  payments: PosPaymentDto[];
}

/**
 * Order payment record (read from backend)
 */
export interface OrderPayment {
  id: string;
  method: PaymentMethod;
  amount: number;
  tipAmount?: number;
  reference?: string;
  createdAt: string;
}

/**
 * M28-KDS-S1: Kitchen Display System Types
 */

/**
 * KDS order status types
 */
export type KdsOrderStatus = 'NEW' | 'IN_PROGRESS' | 'READY' | 'SERVED' | 'VOIDED';

/**
 * Individual order item in KDS
 */
export interface KdsOrderItem {
  id: string;
  name: string;
  quantity: number;
  modifiers?: string[];
  notes?: string | null;
  status: KdsOrderStatus;
}

/**
 * KDS order (ticket) representation
 */
export interface KdsOrder {
  id: string;
  tableLabel?: string | null;
  guestCount?: number | null;
  createdAt: string;
  ticketNumber?: string | null;
  status: KdsOrderStatus;
  items: KdsOrderItem[];
  station?: string | null;
}

/**
 * Response from KDS orders list endpoint
 */
export interface KdsOrderListResponse {
  orders: KdsOrder[];
}

/**
 * M26-EXT2: Modifier Groups & Priced Modifiers
 */

/**
 * Individual modifier option within a group
 */
export interface PosModifierOption {
  id: string;
  name: string;
  priceDelta: number; // positive or negative, in major currency units
  code?: string;      // optional kitchen/code
  isDefault?: boolean;
}

/**
 * Modifier group configuration for a menu item
 */
export interface PosModifierGroup {
  id: string;
  name: string;
  description?: string;
  minSelections: number; // 0 for optional, 1+ for required
  maxSelections: number; // =min for exact, >min for "up to"
  isRequired: boolean;   // convenience flag (minSelections > 0)
  options: PosModifierOption[];
}

/**
 * Applied modifier on an order line
 */
export interface PosOrderLineModifier {
  groupId: string;
  groupName: string;
  optionId: string;
  optionName: string;
  priceDelta: number;
}

/**
 * M26-EXT3: Order Tabs Management
 */

/**
 * Service type classification for tab-based orders
 */
export type PosOrderServiceType = 'DINE_IN' | 'BAR' | 'TAKEOUT' | 'DELIVERY';

/**
 * Tab metadata for open orders
 * Stored in local state and synced to backend order metadata
 */
export interface PosOrderTabInfo {
  orderId: string;
  tabName: string | null;      // Optional custom name (e.g., "John – Bar")
  serviceType: PosOrderServiceType;
  tableLabel: string | null;    // From order.tableLabel
  guestCount: number | null;    // From order.guestCount
  createdAt: string;            // ISO timestamp
  lastModifiedAt: string;       // ISO timestamp
  itemCount: number;            // Total items in order
  orderTotal: number;           // Current order total (major units)
  status: 'OPEN' | 'CLOSED';    // Order lifecycle status
}
