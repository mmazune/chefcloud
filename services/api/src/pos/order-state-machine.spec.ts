import { OrderStateMachine, OrderTransitionContext } from './order-state-machine';
import { BadRequestException } from '@nestjs/common';

describe('OrderStateMachine', () => {
  describe('canTransition', () => {
    it('should allow NEW → SENT', () => {
      expect(OrderStateMachine.canTransition('NEW', 'SENT')).toBe(true);
    });

    it('should allow NEW → VOIDED', () => {
      expect(OrderStateMachine.canTransition('NEW', 'VOIDED')).toBe(true);
    });

    it('should allow SENT → READY', () => {
      expect(OrderStateMachine.canTransition('SENT', 'READY')).toBe(true);
    });

    it('should allow READY → SERVED', () => {
      expect(OrderStateMachine.canTransition('READY', 'SERVED')).toBe(true);
    });

    it('should allow SERVED → CLOSED', () => {
      expect(OrderStateMachine.canTransition('SERVED', 'CLOSED')).toBe(true);
    });

    it('should NOT allow CLOSED → NEW', () => {
      expect(OrderStateMachine.canTransition('CLOSED', 'NEW')).toBe(false);
    });

    it('should NOT allow VOIDED → READY', () => {
      expect(OrderStateMachine.canTransition('VOIDED', 'READY')).toBe(false);
    });

    it('should allow same state transition (no-op)', () => {
      expect(OrderStateMachine.canTransition('NEW', 'NEW')).toBe(true);
      expect(OrderStateMachine.canTransition('CLOSED', 'CLOSED')).toBe(true);
    });
  });

  describe('validateTransition', () => {
    const baseContext: OrderTransitionContext = {
      orderId: 'order_123',
      currentStatus: 'NEW',
      newStatus: 'SENT',
      userId: 'user_123',
      branchId: 'branch_123',
    };

    it('should pass validation for valid NEW → SENT with items', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        hasItems: true,
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).not.toThrow();
    });

    it('should throw error for NEW → SENT without items', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        hasItems: false,
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow(BadRequestException);
      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow('Cannot send order with no items');
    });

    it('should throw error for NEW → VOIDED without reason', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        newStatus: 'VOIDED',
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow(BadRequestException);
      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow('Reason required');
    });

    it('should pass validation for NEW → VOIDED with reason', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        newStatus: 'VOIDED',
        reason: 'Customer changed mind',
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).not.toThrow();
    });

    it('should throw error for SENT → VOIDED without manager approval', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        currentStatus: 'SENT',
        newStatus: 'VOIDED',
        reason: 'Kitchen mistake',
        managerApproved: false,
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow(BadRequestException);
      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow('Manager approval required');
    });

    it('should pass validation for SENT → VOIDED with manager approval', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        currentStatus: 'SENT',
        newStatus: 'VOIDED',
        reason: 'Kitchen mistake',
        managerApproved: true,
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).not.toThrow();
    });

    it('should throw error for SERVED → CLOSED without payment', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        currentStatus: 'SERVED',
        newStatus: 'CLOSED',
        isPaid: false,
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow(BadRequestException);
      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow('Order must be paid');
    });

    it('should pass validation for SERVED → CLOSED with payment', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        currentStatus: 'SERVED',
        newStatus: 'CLOSED',
        isPaid: true,
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).not.toThrow();
    });

    it('should throw error for invalid transition CLOSED → NEW', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        currentStatus: 'CLOSED',
        newStatus: 'NEW',
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow(BadRequestException);
      expect(() => OrderStateMachine.validateTransition(ctx)).toThrow('Invalid state transition');
    });

    it('should allow same state transition without error', () => {
      const ctx: OrderTransitionContext = {
        ...baseContext,
        currentStatus: 'SENT',
        newStatus: 'SENT',
      };

      expect(() => OrderStateMachine.validateTransition(ctx)).not.toThrow();
    });
  });

  describe('getAllowedTransitions', () => {
    it('should return allowed transitions from NEW', () => {
      const transitions = OrderStateMachine.getAllowedTransitions('NEW');
      expect(transitions).toContain('SENT');
      expect(transitions).toContain('VOIDED');
      expect(transitions).toContain('CLOSED');
    });

    it('should return allowed transitions from SENT', () => {
      const transitions = OrderStateMachine.getAllowedTransitions('SENT');
      expect(transitions).toContain('IN_KITCHEN');
      expect(transitions).toContain('READY');
      expect(transitions).toContain('SERVED');
      expect(transitions).toContain('VOIDED');
    });

    it('should return empty array for terminal states with no outbound transitions', () => {
      const transitions = OrderStateMachine.getAllowedTransitions('CLOSED');
      expect(transitions).toEqual([]);
    });
  });

  describe('state permissions', () => {
    it('should allow editing items only in NEW state', () => {
      expect(OrderStateMachine.canEditItems('NEW')).toBe(true);
      expect(OrderStateMachine.canEditItems('SENT')).toBe(false);
      expect(OrderStateMachine.canEditItems('CLOSED')).toBe(false);
    });

    it('should allow sending only from NEW state', () => {
      expect(OrderStateMachine.canSend('NEW')).toBe(true);
      expect(OrderStateMachine.canSend('SENT')).toBe(false);
    });

    it('should allow payment from READY or SERVED', () => {
      expect(OrderStateMachine.canPay('READY')).toBe(true);
      expect(OrderStateMachine.canPay('SERVED')).toBe(true);
      expect(OrderStateMachine.canPay('NEW')).toBe(false);
      expect(OrderStateMachine.canPay('CLOSED')).toBe(false);
    });

    it('should allow voiding from NEW, SENT, IN_KITCHEN', () => {
      expect(OrderStateMachine.canVoid('NEW')).toBe(true);
      expect(OrderStateMachine.canVoid('SENT')).toBe(true);
      expect(OrderStateMachine.canVoid('IN_KITCHEN')).toBe(true);
      expect(OrderStateMachine.canVoid('READY')).toBe(false);
      expect(OrderStateMachine.canVoid('CLOSED')).toBe(false);
    });

    it('should allow discounts before closed', () => {
      expect(OrderStateMachine.canDiscount('NEW')).toBe(true);
      expect(OrderStateMachine.canDiscount('SENT')).toBe(true);
      expect(OrderStateMachine.canDiscount('SERVED')).toBe(true);
      expect(OrderStateMachine.canDiscount('CLOSED')).toBe(false);
    });

    it('should identify terminal states', () => {
      expect(OrderStateMachine.isTerminal('VOIDED')).toBe(true);
      expect(OrderStateMachine.isTerminal('CLOSED')).toBe(true);
      expect(OrderStateMachine.isTerminal('NEW')).toBe(false);
      expect(OrderStateMachine.isTerminal('SENT')).toBe(false);
    });

    it('should identify in-progress states', () => {
      expect(OrderStateMachine.isInProgress('SENT')).toBe(true);
      expect(OrderStateMachine.isInProgress('READY')).toBe(true);
      expect(OrderStateMachine.isInProgress('SERVED')).toBe(true);
      expect(OrderStateMachine.isInProgress('NEW')).toBe(false);
      expect(OrderStateMachine.isInProgress('CLOSED')).toBe(false);
    });
  });

  describe('validateOperation', () => {
    it('should allow EDIT operation in NEW state', () => {
      expect(() => OrderStateMachine.validateOperation('EDIT', 'NEW')).not.toThrow();
    });

    it('should throw error for EDIT operation in SENT state', () => {
      expect(() => OrderStateMachine.validateOperation('EDIT', 'SENT')).toThrow(BadRequestException);
      expect(() => OrderStateMachine.validateOperation('EDIT', 'SENT')).toThrow('Operation EDIT not allowed');
    });

    it('should allow PAY operation in SERVED state', () => {
      expect(() => OrderStateMachine.validateOperation('PAY', 'SERVED')).not.toThrow();
    });

    it('should throw error for PAY operation in NEW state', () => {
      expect(() => OrderStateMachine.validateOperation('PAY', 'NEW')).toThrow(BadRequestException);
    });

    it('should allow VOID operation in SENT state', () => {
      expect(() => OrderStateMachine.validateOperation('VOID', 'SENT')).not.toThrow();
    });

    it('should throw error for VOID operation in CLOSED state', () => {
      expect(() => OrderStateMachine.validateOperation('VOID', 'CLOSED')).toThrow(BadRequestException);
    });
  });

  describe('helper methods', () => {
    it('should get state descriptions', () => {
      expect(OrderStateMachine.getStateDescription('NEW')).toContain('created');
      expect(OrderStateMachine.getStateDescription('SENT')).toContain('kitchen');
      expect(OrderStateMachine.getStateDescription('CLOSED')).toContain('finalized');
    });

    it('should get next recommended state', () => {
      expect(OrderStateMachine.getNextState('NEW')).toBe('SENT');
      expect(OrderStateMachine.getNextState('SENT')).toBe('READY');
      expect(OrderStateMachine.getNextState('READY')).toBe('SERVED');
      expect(OrderStateMachine.getNextState('SERVED')).toBe('CLOSED');
      expect(OrderStateMachine.getNextState('CLOSED')).toBeNull();
    });

    it('should get audit action names', () => {
      expect(OrderStateMachine.getAuditAction('NEW', 'SENT')).toBe('order.sent_to_kitchen');
      expect(OrderStateMachine.getAuditAction('SERVED', 'CLOSED')).toBe('order.closed');
      expect(OrderStateMachine.getAuditAction('NEW', 'VOIDED')).toBe('order.voided_before_preparation');
    });
  });
});
