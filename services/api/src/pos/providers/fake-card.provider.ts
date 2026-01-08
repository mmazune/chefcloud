/**
 * M13.4: Fake Card Provider for Testing
 * 
 * Deterministic behavior for E2E tests:
 * - 'test-token-success' → authorization succeeds
 * - 'test-token-decline' → authorization fails with CARD_DECLINED
 * - 'test-token-insufficient' → fails with INSUFFICIENT_FUNDS
 * - Any other token → succeeds
 * 
 * PCI-NEUTRAL: No real card data is ever processed.
 */

import { Injectable } from '@nestjs/common';
import {
  PaymentProvider,
  AuthResult,
  CaptureResult,
  VoidResult,
  RefundResult,
} from './payment-provider.interface';
import { randomUUID } from 'crypto';

// In-memory store for test authorizations
interface TestAuth {
  authId: string;
  amountCents: number;
  currency: string;
  status: 'AUTHORIZED' | 'CAPTURED' | 'VOIDED' | 'REFUNDED';
  capturedCents: number;
  refundedCents: number;
}

@Injectable()
export class FakeCardProvider implements PaymentProvider {
  readonly name = 'FAKE_CARD';

  // In-memory store for deterministic testing
  private authorizations = new Map<string, TestAuth>();

  async authorize(
    amountCents: number,
    token: string,
    currency = 'USD',
  ): Promise<AuthResult> {
    // Deterministic failure patterns
    if (token === 'test-token-decline') {
      return {
        success: false,
        errorCode: 'CARD_DECLINED',
        errorMessage: 'The card was declined by the issuing bank',
      };
    }

    if (token === 'test-token-insufficient') {
      return {
        success: false,
        errorCode: 'INSUFFICIENT_FUNDS',
        errorMessage: 'Insufficient funds on the card',
      };
    }

    if (token === 'test-token-expired') {
      return {
        success: false,
        errorCode: 'CARD_EXPIRED',
        errorMessage: 'The card has expired',
      };
    }

    // Success case
    const authId = `fake_auth_${randomUUID()}`;
    this.authorizations.set(authId, {
      authId,
      amountCents,
      currency,
      status: 'AUTHORIZED',
      capturedCents: 0,
      refundedCents: 0,
    });

    return {
      success: true,
      authId,
    };
  }

  async capture(authId: string, amountCents?: number): Promise<CaptureResult> {
    const auth = this.authorizations.get(authId);

    if (!auth) {
      return {
        success: false,
        capturedAmountCents: 0,
        errorCode: 'AUTH_NOT_FOUND',
        errorMessage: 'Authorization not found',
      };
    }

    if (auth.status === 'CAPTURED') {
      // Idempotent: return same result
      return {
        success: true,
        capturedAmountCents: auth.capturedCents,
      };
    }

    if (auth.status !== 'AUTHORIZED') {
      return {
        success: false,
        capturedAmountCents: 0,
        errorCode: 'INVALID_STATUS',
        errorMessage: `Cannot capture authorization in ${auth.status} status`,
      };
    }

    const captureAmount = amountCents ?? auth.amountCents;
    if (captureAmount > auth.amountCents) {
      return {
        success: false,
        capturedAmountCents: 0,
        errorCode: 'AMOUNT_EXCEEDS_AUTH',
        errorMessage: 'Capture amount exceeds authorized amount',
      };
    }

    auth.status = 'CAPTURED';
    auth.capturedCents = captureAmount;
    this.authorizations.set(authId, auth);

    return {
      success: true,
      capturedAmountCents: captureAmount,
    };
  }

  async void(authId: string): Promise<VoidResult> {
    const auth = this.authorizations.get(authId);

    if (!auth) {
      return {
        success: false,
        errorCode: 'AUTH_NOT_FOUND',
        errorMessage: 'Authorization not found',
      };
    }

    if (auth.status === 'VOIDED') {
      // Idempotent
      return { success: true };
    }

    if (auth.status !== 'AUTHORIZED') {
      return {
        success: false,
        errorCode: 'INVALID_STATUS',
        errorMessage: `Cannot void authorization in ${auth.status} status`,
      };
    }

    auth.status = 'VOIDED';
    this.authorizations.set(authId, auth);

    return { success: true };
  }

  async refund(authId: string, amountCents: number): Promise<RefundResult> {
    const auth = this.authorizations.get(authId);

    if (!auth) {
      return {
        success: false,
        refundedAmountCents: 0,
        errorCode: 'AUTH_NOT_FOUND',
        errorMessage: 'Authorization not found',
      };
    }

    if (auth.status !== 'CAPTURED' && auth.status !== 'REFUNDED') {
      return {
        success: false,
        refundedAmountCents: 0,
        errorCode: 'INVALID_STATUS',
        errorMessage: `Cannot refund authorization in ${auth.status} status`,
      };
    }

    const remaining = auth.capturedCents - auth.refundedCents;
    if (amountCents > remaining) {
      return {
        success: false,
        refundedAmountCents: 0,
        errorCode: 'REFUND_EXCEEDS_CAPTURED',
        errorMessage: `Refund amount ${amountCents} exceeds remaining ${remaining}`,
      };
    }

    auth.refundedCents += amountCents;
    if (auth.refundedCents >= auth.capturedCents) {
      auth.status = 'REFUNDED';
    }
    this.authorizations.set(authId, auth);

    return {
      success: true,
      refundedAmountCents: amountCents,
      refundId: `fake_refund_${randomUUID()}`,
    };
  }

  // Test helper: clear all authorizations
  clearAll(): void {
    this.authorizations.clear();
  }

  // Test helper: get authorization state
  getAuth(authId: string): TestAuth | undefined {
    return this.authorizations.get(authId);
  }
}
