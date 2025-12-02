/**
 * useSendDevWebhookTest hook for E23-DEVPORTAL-FE-S2
 * Sends test events to webhook endpoints
 */

import { useState } from 'react';
import {
  DevWebhookTestEventRequestDto,
  DevWebhookTestEventResponseDto,
} from '@/types/devPortal';
import { sendDevWebhookTestEvent } from '@/lib/devPortalApi';

interface Result {
  isSending: boolean;
  error: Error | null;
  lastResult: DevWebhookTestEventResponseDto | null;
  sendTest: (
    payload: DevWebhookTestEventRequestDto,
  ) => Promise<DevWebhookTestEventResponseDto | null>;
}

export function useSendDevWebhookTest(): Result {
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [lastResult, setLastResult] =
    useState<DevWebhookTestEventResponseDto | null>(null);

  async function sendTest(
    payload: DevWebhookTestEventRequestDto,
  ): Promise<DevWebhookTestEventResponseDto | null> {
    setIsSending(true);
    setError(null);
    try {
      const res = await sendDevWebhookTestEvent(payload);
      setLastResult(res);
      return res;
    } catch (err) {
      setError(err as Error);
      setLastResult(null);
      return null;
    } finally {
      setIsSending(false);
    }
  }

  return { isSending, error, lastResult, sendTest };
}
