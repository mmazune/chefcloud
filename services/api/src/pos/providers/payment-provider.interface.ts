/**
 * M13.4: Payment Provider Interface
 * 
 * This interface defines the contract for payment providers.
 * Currently implements FakeCardProvider for testing; future integrations
 * (Stripe, Square, etc.) would implement this interface.
 * 
 * PCI-NEUTRAL: This codebase does NOT handle real card data.
 * Card tokens are synthetic/test-only.
 */

export interface AuthResult {
  success: boolean;
  authId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface CaptureResult {
  success: boolean;
  capturedAmountCents: number;
  errorCode?: string;
  errorMessage?: string;
}

export interface VoidResult {
  success: boolean;
  errorCode?: string;
  errorMessage?: string;
}

export interface RefundResult {
  success: boolean;
  refundedAmountCents: number;
  refundId?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface PaymentProvider {
  readonly name: string;

  /**
   * Authorize a payment without capturing
   * @param amountCents Amount in cents to authorize
   * @param token Card/payment token (test tokens only in this implementation)
   * @param currency Currency code (default USD)
   */
  authorize(
    amountCents: number,
    token: string,
    currency?: string,
  ): Promise<AuthResult>;

  /**
   * Capture a previously authorized payment
   * @param authId Authorization ID from authorize()
   * @param amountCents Amount to capture (must be <= authorized amount)
   */
  capture(authId: string, amountCents?: number): Promise<CaptureResult>;

  /**
   * Void an authorized but not captured payment
   * @param authId Authorization ID
   */
  void(authId: string): Promise<VoidResult>;

  /**
   * Refund a captured payment
   * @param authId Authorization/transaction ID
   * @param amountCents Amount to refund
   */
  refund(authId: string, amountCents: number): Promise<RefundResult>;
}
