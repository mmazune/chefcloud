import { OrderTotalsCalculator } from './order-totals-calculator';
import { Order, Payment } from '@chefcloud/db';
import { Decimal } from '@prisma/client/runtime/library';

describe('OrderTotalsCalculator', () => {
  const mockOrder = (total: number): Order =>
    ({
      id: 'order-1',
      branchId: 'branch-1',
      tableId: null,
      userId: 'user-1',
      orderNumber: 'ORD-001',
      status: 'OPEN' as any,
      serviceType: 'DINE_IN' as any,
      subtotal: new Decimal(total),
      tax: new Decimal(0),
      discount: new Decimal(0),
      total: new Decimal(total),
      anomalyFlags: [],
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any;

  const mockPayment = (
    amount: number,
    tipAmount: number | null = null,
    status: string = 'completed',
  ): Payment =>
    ({
      id: `payment-${Math.random()}`,
      orderId: 'order-1',
      amount: new Decimal(amount),
      tipAmount: tipAmount !== null ? new Decimal(tipAmount) : null,
      method: 'CASH' as any,
      status,
      transactionId: null,
      metadata: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    }) as any;

  describe('getTotalDue', () => {
    it('should return order.total as number', () => {
      const order = mockOrder(100);
      expect(OrderTotalsCalculator.getTotalDue(order)).toBe(100);
    });

    it('should handle decimal values correctly', () => {
      const order = mockOrder(123.45);
      expect(OrderTotalsCalculator.getTotalDue(order)).toBe(123.45);
    });
  });

  describe('calculateTotalPaid', () => {
    it('should return 0 for empty payments array', () => {
      expect(OrderTotalsCalculator.calculateTotalPaid([])).toBe(0);
    });

    it('should sum completed payments only', () => {
      const payments = [
        mockPayment(50, null, 'completed'),
        mockPayment(30, null, 'pending'), // Not included
        mockPayment(20, null, 'completed'),
      ];
      expect(OrderTotalsCalculator.calculateTotalPaid(payments)).toBe(70);
    });

    it('should exclude pending and failed payments', () => {
      const payments = [
        mockPayment(100, null, 'completed'),
        mockPayment(50, null, 'pending'),
        mockPayment(25, null, 'failed'),
      ];
      expect(OrderTotalsCalculator.calculateTotalPaid(payments)).toBe(100);
    });

    it('should NOT include tipAmount in totalPaid', () => {
      const payments = [
        mockPayment(100, 10, 'completed'), // Amount=100, tip=10
      ];
      expect(OrderTotalsCalculator.calculateTotalPaid(payments)).toBe(100);
    });
  });

  describe('calculateBalanceDue', () => {
    it('should return totalDue when no payments', () => {
      const order = mockOrder(100);
      expect(OrderTotalsCalculator.calculateBalanceDue(order, [])).toBe(100);
    });

    it('should return 0 when fully paid', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(100)];
      expect(OrderTotalsCalculator.calculateBalanceDue(order, payments)).toBe(0);
    });

    it('should return positive balance when underpaid', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(60)];
      expect(OrderTotalsCalculator.calculateBalanceDue(order, payments)).toBe(40);
    });

    it('should return negative balance when overpaid', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(110)];
      expect(OrderTotalsCalculator.calculateBalanceDue(order, payments)).toBe(-10);
    });

    it('should handle split payments correctly', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(60), mockPayment(40)];
      expect(OrderTotalsCalculator.calculateBalanceDue(order, payments)).toBe(0);
    });

    it('should handle 3-way split with overpayment', () => {
      const order = mockOrder(100);
      const payments = [
        mockPayment(40),
        mockPayment(40),
        mockPayment(25), // Total = 105 (overpaid by 5)
      ];
      expect(OrderTotalsCalculator.calculateBalanceDue(order, payments)).toBe(-5);
    });
  });

  describe('calculateTipTotal', () => {
    it('should return 0 when no payments', () => {
      expect(OrderTotalsCalculator.calculateTipTotal([])).toBe(0);
    });

    it('should return 0 when no tips', () => {
      const payments = [mockPayment(100, null), mockPayment(50, null)];
      expect(OrderTotalsCalculator.calculateTipTotal(payments)).toBe(0);
    });

    it('should sum all tipAmounts', () => {
      const payments = [mockPayment(100, 10), mockPayment(50, 5)];
      expect(OrderTotalsCalculator.calculateTipTotal(payments)).toBe(15);
    });

    it('should include tips from pending payments', () => {
      const payments = [
        mockPayment(100, 10, 'completed'),
        mockPayment(50, 5, 'pending'), // Tip still counted
      ];
      expect(OrderTotalsCalculator.calculateTipTotal(payments)).toBe(15);
    });

    it('should handle mixed null and valued tips', () => {
      const payments = [mockPayment(100, 10), mockPayment(50, null), mockPayment(75, 7.5)];
      expect(OrderTotalsCalculator.calculateTipTotal(payments)).toBe(17.5);
    });
  });

  describe('canClose', () => {
    it('should return true when fully paid', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(100)];
      expect(OrderTotalsCalculator.canClose(order, payments)).toBe(true);
    });

    it('should return true when overpaid', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(105)];
      expect(OrderTotalsCalculator.canClose(order, payments)).toBe(true);
    });

    it('should return false when underpaid beyond tolerance', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(95)]; // Underpaid by 5
      expect(OrderTotalsCalculator.canClose(order, payments)).toBe(false);
    });

    it('should return true when underpaid within default tolerance (0.01)', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(99.995)]; // Underpaid by 0.005
      expect(OrderTotalsCalculator.canClose(order, payments)).toBe(true);
    });

    it('should respect custom tolerance', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(95)]; // Underpaid by 5
      expect(OrderTotalsCalculator.canClose(order, payments, 5.0)).toBe(true);
      expect(OrderTotalsCalculator.canClose(order, payments, 4.99)).toBe(false);
    });
  });

  describe('getSummary', () => {
    it('should return complete summary', () => {
      const order = mockOrder(100);
      const payments = [
        mockPayment(60, 6, 'completed'),
        mockPayment(40, 4, 'completed'),
        mockPayment(10, 1, 'pending'),
      ];

      const summary = OrderTotalsCalculator.getSummary(order, payments);

      expect(summary).toEqual({
        totalDue: 100,
        totalPaid: 100,
        balanceDue: 0,
        tipTotal: 11, // 6 + 4 + 1
        canClose: true,
        paymentsCount: 3,
        completedPaymentsCount: 2,
      });
    });

    it('should show underpayment scenario', () => {
      const order = mockOrder(150);
      const payments = [mockPayment(50, 5, 'completed')];

      const summary = OrderTotalsCalculator.getSummary(order, payments);

      expect(summary).toEqual({
        totalDue: 150,
        totalPaid: 50,
        balanceDue: 100,
        tipTotal: 5,
        canClose: false,
        paymentsCount: 1,
        completedPaymentsCount: 1,
      });
    });

    it('should show overpayment scenario', () => {
      const order = mockOrder(100);
      const payments = [mockPayment(110, 10, 'completed')];

      const summary = OrderTotalsCalculator.getSummary(order, payments);

      expect(summary).toEqual({
        totalDue: 100,
        totalPaid: 110,
        balanceDue: -10,
        tipTotal: 10,
        canClose: true,
        paymentsCount: 1,
        completedPaymentsCount: 1,
      });
    });
  });
});
