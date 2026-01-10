// Shared types and schemas
import { z } from 'zod';

// API Response types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface HealthResponse {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  version: string;
  services?: {
    database?: 'ok' | 'down';
    redis?: 'ok' | 'down';
  };
}

// Order DTOs
export const CreateOrderItemSchema = z.object({
  menuItemId: z.string(),
  quantity: z.number().int().positive(),
  notes: z.string().optional(),
  modifiers: z.array(z.string()).optional(),
});

export const CreateOrderSchema = z.object({
  tableId: z.string().optional(),
  items: z.array(CreateOrderItemSchema),
});

export type CreateOrderDto = z.infer<typeof CreateOrderSchema>;
export type CreateOrderItemDto = z.infer<typeof CreateOrderItemSchema>;

// Payment DTOs
export const CreatePaymentSchema = z.object({
  orderId: z.string(),
  amount: z.number().positive(),
  method: z.enum(['cash', 'momo', 'airtel', 'card']),
  transactionId: z.string().optional(),
});

export type CreatePaymentDto = z.infer<typeof CreatePaymentSchema>;

// Version info
export interface VersionInfo {
  version: string;
  buildDate: string;
  commit?: string;
}

// RBAC - Role Capability Model
export * from './rbac';
