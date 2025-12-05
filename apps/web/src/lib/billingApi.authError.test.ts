/**
 * M32-SEC-S2: Sanity tests for billing API auth error handling
 */

import { fetchBillingPlans } from './billingApi';
import * as authHttpError from './authHttpError';

// Mock the auth error handler
jest.mock('./authHttpError', () => ({
  handleAuthHttpError: jest.fn(),
}));

const mockHandleAuthHttpError = authHttpError.handleAuthHttpError as jest.MockedFunction<
  typeof authHttpError.handleAuthHttpError
>;

describe('billingApi auth error handling', () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it('calls auth error handler on 401', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 401,
      ok: false,
      json: jest.fn(),
    } as any);

    await expect(fetchBillingPlans()).rejects.toThrow('Unauthorized');
    expect(mockHandleAuthHttpError).toHaveBeenCalledWith(401);
  });

  it('calls auth error handler on 419', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 419,
      ok: false,
      json: jest.fn(),
    } as any);

    await expect(fetchBillingPlans()).rejects.toThrow('Unauthorized');
    expect(mockHandleAuthHttpError).toHaveBeenCalledWith(419);
  });

  it('does not call auth error handler on 500', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 500,
      ok: false,
      text: jest.fn().mockResolvedValue('Server error'),
      json: jest.fn(),
    } as any);

    await expect(fetchBillingPlans()).rejects.toThrow();
    expect(mockHandleAuthHttpError).not.toHaveBeenCalled();
  });

  it('does not call auth error handler on success', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: jest.fn().mockResolvedValue([]),
    } as any);

    await fetchBillingPlans();
    expect(mockHandleAuthHttpError).not.toHaveBeenCalled();
  });
});
