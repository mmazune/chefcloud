import { Order, Payment } from '@chefcloud/db';

/**
 * M12: Utility for calculating order monetary totals and balances.
 *
 * Canonical monetary model:
 * - totalDue = order.total (subtotal - discount + tax)
 * - totalPaid = sum(payments.amount where status='completed')
 * - balanceDue = totalDue - totalPaid
 * - tipTotal = sum(payments.tipAmount)
 */
export class OrderTotalsCalculator {
  /**
   * Get the total amount due for an order (from order.total field).
   * This is subtotal - discount + tax.
   */
  static getTotalDue(order: Order): number {
    return Number(order.total);
  }

  /**
   * Calculate total amount paid (sum of completed payment amounts, excluding tips).
   * Only includes payments with status='completed'.
   */
  static calculateTotalPaid(payments: Payment[]): number {
    return payments
      .filter((p) => p.status === 'completed')
      .reduce((sum, p) => sum + Number(p.amount), 0);
  }

  /**
   * Calculate balance due (totalDue - totalPaid).
   * Negative balance means overpayment.
   */
  static calculateBalanceDue(order: Order, payments: Payment[]): number {
    const totalDue = this.getTotalDue(order);
    const totalPaid = this.calculateTotalPaid(payments);
    return totalDue - totalPaid;
  }

  /**
   * Calculate total tips (sum of all tipAmount fields).
   * Tips are NOT included in totalDue/balanceDue calculations.
   */
  static calculateTipTotal(payments: Payment[]): number {
    return payments.reduce((sum, p) => sum + Number(p.tipAmount || 0), 0);
  }

  /**
   * Check if order can be closed (balanceDue <= tolerance).
   * @param tolerance - Allowable underpayment in currency units (default 0.01)
   */
  static canClose(order: Order, payments: Payment[], tolerance: number = 0.01): boolean {
    const balanceDue = this.calculateBalanceDue(order, payments);
    return balanceDue <= tolerance;
  }

  /**
   * Get a summary of order monetary state.
   */
  static getSummary(order: Order, payments: Payment[]) {
    const totalDue = this.getTotalDue(order);
    const totalPaid = this.calculateTotalPaid(payments);
    const balanceDue = this.calculateBalanceDue(order, payments);
    const tipTotal = this.calculateTipTotal(payments);
    const canClose = this.canClose(order, payments);

    return {
      totalDue,
      totalPaid,
      balanceDue,
      tipTotal,
      canClose,
      paymentsCount: payments.length,
      completedPaymentsCount: payments.filter((p) => p.status === 'completed').length,
    };
  }
}
