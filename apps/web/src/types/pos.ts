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
