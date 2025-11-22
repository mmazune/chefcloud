/* eslint-disable @typescript-eslint/no-explicit-any */
import { BadRequestException, ForbiddenException } from '@nestjs/common';

// OrderStatus enum type
export type OrderStatus =
  | 'NEW'
  | 'SENT'
  | 'IN_KITCHEN'
  | 'READY'
  | 'SERVED'
  | 'VOIDED'
  | 'CLOSED';

/**
 * M11: Canonical Order State Machine
 * 
 * Enforces valid state transitions and business rules for order lifecycle.
 * All order status changes MUST go through this state machine.
 * 
 * State Flow:
 * NEW → SENT → IN_KITCHEN → READY → SERVED → CLOSED
 *   ↓
 * VOIDED (from NEW, SENT only under strict conditions)
 * 
 * Business Rules:
 * - Items can be edited only in NEW state
 * - Payments allowed only from SERVED or READY state
 * - Voids after preparation require manager approval
 * - CLOSED orders are immutable (except post-close void with GL reversal)
 */

export interface OrderTransitionContext {
  orderId: string;
  currentStatus: OrderStatus;
  newStatus: OrderStatus;
  userId: string;
  branchId: string;
  reason?: string;
  metadata?: Record<string, any>;
  // For conditional transitions
  hasItems?: boolean;
  allItemsReady?: boolean;
  isPaid?: boolean;
  managerApproved?: boolean;
}

export interface TransitionRule {
  from: OrderStatus;
  to: OrderStatus;
  condition?: (ctx: OrderTransitionContext) => boolean | string; // true = allowed, string = error message
  requiresReason?: boolean;
  requiresManagerApproval?: boolean;
  auditAction: string;
}

/**
 * Allowed state transitions matrix
 */
const TRANSITION_RULES: TransitionRule[] = [
  // NEW → SENT: First fire to kitchen/bar
  {
    from: 'NEW',
    to: 'SENT',
    condition: (ctx) => ctx.hasItems || 'Cannot send order with no items',
    auditAction: 'order.sent_to_kitchen',
  },

  // NEW → VOIDED: Cancel before preparation
  {
    from: 'NEW',
    to: 'VOIDED',
    requiresReason: true,
    auditAction: 'order.voided_before_preparation',
  },

  // SENT → IN_KITCHEN: Acknowledged by KDS (optional state)
  {
    from: 'SENT',
    to: 'IN_KITCHEN',
    auditAction: 'order.acknowledged_by_kds',
  },

  // SENT → READY: Direct transition if no IN_KITCHEN state used
  {
    from: 'SENT',
    to: 'READY',
    condition: (ctx) => ctx.allItemsReady || 'Not all items are ready',
    auditAction: 'order.marked_ready',
  },

  // SENT → VOIDED: Cancel after fire (requires manager approval)
  {
    from: 'SENT',
    to: 'VOIDED',
    requiresReason: true,
    requiresManagerApproval: true,
    condition: (ctx) => ctx.managerApproved || 'Manager approval required to void after kitchen send',
    auditAction: 'order.voided_after_send',
  },

  // IN_KITCHEN → READY: All items prepared
  {
    from: 'IN_KITCHEN',
    to: 'READY',
    condition: (ctx) => ctx.allItemsReady || 'Not all items are ready',
    auditAction: 'order.marked_ready',
  },

  // IN_KITCHEN → VOIDED: Cancel during preparation (requires manager approval)
  {
    from: 'IN_KITCHEN',
    to: 'VOIDED',
    requiresReason: true,
    requiresManagerApproval: true,
    condition: (ctx) => ctx.managerApproved || 'Manager approval required to void during preparation',
    auditAction: 'order.voided_during_preparation',
  },

  // READY → SERVED: Delivered to guest
  {
    from: 'READY',
    to: 'SERVED',
    auditAction: 'order.served',
  },

  // READY → CLOSED: Direct close (skip SERVED if not tracked)
  {
    from: 'READY',
    to: 'CLOSED',
    condition: (ctx) => ctx.isPaid || 'Order must be paid before closing',
    auditAction: 'order.closed',
  },

  // SERVED → CLOSED: Payment and close
  {
    from: 'SERVED',
    to: 'CLOSED',
    condition: (ctx) => ctx.isPaid || 'Order must be paid before closing',
    auditAction: 'order.closed',
  },

  // SENT → SERVED: Fast-food scenario (skip READY state)
  {
    from: 'SENT',
    to: 'SERVED',
    auditAction: 'order.served_directly',
  },

  // NEW → CLOSED: Quick close for special cases (e.g., prepaid, comp)
  {
    from: 'NEW',
    to: 'CLOSED',
    condition: (ctx) => ctx.isPaid || 'Order must be paid before closing',
    auditAction: 'order.closed_without_send',
  },
];

/**
 * Business rules for operations by state
 */
export const STATE_PERMISSIONS = {
  // Which states allow editing items
  CAN_EDIT_ITEMS: ['NEW'] as OrderStatus[],

  // Which states allow sending to kitchen
  CAN_SEND: ['NEW'] as OrderStatus[],

  // Which states allow payment
  CAN_PAY: ['READY', 'SERVED'] as OrderStatus[],

  // Which states allow voiding
  CAN_VOID: ['NEW', 'SENT', 'IN_KITCHEN'] as OrderStatus[],

  // Which states allow discounts
  CAN_DISCOUNT: ['NEW', 'SENT', 'IN_KITCHEN', 'READY', 'SERVED'] as OrderStatus[],

  // Which states are considered "in progress"
  IN_PROGRESS: ['SENT', 'IN_KITCHEN', 'READY', 'SERVED'] as OrderStatus[],

  // Which states are terminal (no further changes)
  TERMINAL: ['VOIDED', 'CLOSED'] as OrderStatus[],
};

export class OrderStateMachine {
  /**
   * Check if a state transition is allowed
   */
  static canTransition(from: OrderStatus, to: OrderStatus): boolean {
    // Allow same state (no-op)
    if (from === to) return true;

    // Find matching rule
    const rule = TRANSITION_RULES.find((r) => r.from === from && r.to === to);
    return !!rule;
  }

  /**
   * Get transition rule for a state change
   */
  static getTransitionRule(from: OrderStatus, to: OrderStatus): TransitionRule | undefined {
    return TRANSITION_RULES.find((r) => r.from === from && r.to === to);
  }

  /**
   * Validate a state transition with context
   * Throws BadRequestException or ForbiddenException if invalid
   */
  static validateTransition(ctx: OrderTransitionContext): void {
    // Allow same state (no-op)
    if (ctx.currentStatus === ctx.newStatus) {
      return;
    }

    // Find transition rule
    const rule = this.getTransitionRule(ctx.currentStatus, ctx.newStatus);

    if (!rule) {
      throw new BadRequestException(
        `Invalid state transition: ${ctx.currentStatus} → ${ctx.newStatus}. ` +
          `Allowed transitions from ${ctx.currentStatus}: ${this.getAllowedTransitions(ctx.currentStatus).join(', ')}`,
      );
    }

    // Check condition if present
    if (rule.condition) {
      const result = rule.condition(ctx);
      if (result !== true) {
        throw new BadRequestException(
          typeof result === 'string' ? result : `Condition not met for transition ${ctx.currentStatus} → ${ctx.newStatus}`,
        );
      }
    }

    // Check reason if required
    if (rule.requiresReason && !ctx.reason) {
      throw new BadRequestException(`Reason required for transition ${ctx.currentStatus} → ${ctx.newStatus}`);
    }

    // Check manager approval if required
    if (rule.requiresManagerApproval && !ctx.managerApproved) {
      throw new ForbiddenException(`Manager approval required for transition ${ctx.currentStatus} → ${ctx.newStatus}`);
    }
  }

  /**
   * Get all allowed transitions from a given state
   */
  static getAllowedTransitions(from: OrderStatus): OrderStatus[] {
    return TRANSITION_RULES.filter((r) => r.from === from).map((r) => r.to);
  }

  /**
   * Get audit action name for a transition
   */
  static getAuditAction(from: OrderStatus, to: OrderStatus): string {
    const rule = this.getTransitionRule(from, to);
    return rule?.auditAction || `order.status_changed_${from}_to_${to}`;
  }

  /**
   * Check if order state allows editing items
   */
  static canEditItems(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.CAN_EDIT_ITEMS.includes(status);
  }

  /**
   * Check if order state allows sending to kitchen
   */
  static canSend(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.CAN_SEND.includes(status);
  }

  /**
   * Check if order state allows payment
   */
  static canPay(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.CAN_PAY.includes(status);
  }

  /**
   * Check if order state allows voiding
   */
  static canVoid(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.CAN_VOID.includes(status);
  }

  /**
   * Check if order state allows discounts
   */
  static canDiscount(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.CAN_DISCOUNT.includes(status);
  }

  /**
   * Check if order is in terminal state (no further changes)
   */
  static isTerminal(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.TERMINAL.includes(status);
  }

  /**
   * Check if order is in progress (sent but not closed)
   */
  static isInProgress(status: OrderStatus): boolean {
    return STATE_PERMISSIONS.IN_PROGRESS.includes(status);
  }

  /**
   * Get human-readable state description
   */
  static getStateDescription(status: OrderStatus): string {
    const descriptions: Record<OrderStatus, string> = {
      NEW: 'Order created, items being added',
      SENT: 'Sent to kitchen/bar for preparation',
      IN_KITCHEN: 'Acknowledged by kitchen, preparation in progress',
      READY: 'All items prepared, ready to serve',
      SERVED: 'Delivered to guest',
      VOIDED: 'Cancelled/voided',
      CLOSED: 'Payment completed, order finalized',
    };
    return descriptions[status] || status;
  }

  /**
   * Get next recommended state (for UI guidance)
   */
  static getNextState(current: OrderStatus): OrderStatus | null {
    const nextStates: Partial<Record<OrderStatus, OrderStatus>> = {
      NEW: 'SENT',
      SENT: 'READY',
      IN_KITCHEN: 'READY',
      READY: 'SERVED',
      SERVED: 'CLOSED',
    };
    return nextStates[current] || null;
  }

  /**
   * Validate operation permission
   * Generic method for checking if an operation is allowed in current state
   */
  static validateOperation(
    operation: 'EDIT' | 'SEND' | 'PAY' | 'VOID' | 'DISCOUNT',
    currentStatus: OrderStatus,
  ): void {
    const checks: Record<typeof operation, (status: OrderStatus) => boolean> = {
      EDIT: this.canEditItems,
      SEND: this.canSend,
      PAY: this.canPay,
      VOID: this.canVoid,
      DISCOUNT: this.canDiscount,
    };

    const check = checks[operation];
    if (!check(currentStatus)) {
      throw new BadRequestException(
        `Operation ${operation} not allowed in state ${currentStatus}. ` +
          `Current state: ${this.getStateDescription(currentStatus)}`,
      );
    }
  }
}
