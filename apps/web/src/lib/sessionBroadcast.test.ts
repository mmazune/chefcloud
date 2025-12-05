/**
 * M32-SEC-S3: Tests for sessionBroadcast utility
 */

import {
  broadcastSessionEvent,
  subscribeSessionEvents,
} from './sessionBroadcast';

describe('sessionBroadcast', () => {
  const STORAGE_KEY = 'chefcloud_session_event_v1';

  beforeEach(() => {
    window.localStorage.clear();
  });

  test('broadcastSessionEvent writes event to localStorage', () => {
    broadcastSessionEvent('logout');

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string);
    expect(parsed.type).toBe('logout');
    expect(typeof parsed.at).toBe('number');
  });

  test('broadcastSessionEvent writes login event', () => {
    broadcastSessionEvent('login');

    const raw = window.localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const parsed = JSON.parse(raw as string);
    expect(parsed.type).toBe('login');
    expect(typeof parsed.at).toBe('number');
  });

  test('subscribeSessionEvents listens to storage events', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeSessionEvents(handler);

    const payload = JSON.stringify({ type: 'logout', at: 123 });
    const event = new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: payload,
    });

    window.dispatchEvent(event);

    expect(handler).toHaveBeenCalledWith({ type: 'logout', at: 123 });

    unsubscribe();
  });

  test('subscribeSessionEvents ignores events with wrong key', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeSessionEvents(handler);

    const payload = JSON.stringify({ type: 'logout', at: 123 });
    const event = new StorageEvent('storage', {
      key: 'some_other_key',
      newValue: payload,
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();

    unsubscribe();
  });

  test('subscribeSessionEvents ignores events with null newValue', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeSessionEvents(handler);

    const event = new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: null,
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();

    unsubscribe();
  });

  test('subscribeSessionEvents ignores malformed JSON', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeSessionEvents(handler);

    const event = new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: 'not valid json{',
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();

    unsubscribe();
  });

  test('subscribeSessionEvents unsubscribe stops listening', () => {
    const handler = jest.fn();
    const unsubscribe = subscribeSessionEvents(handler);

    unsubscribe();

    const payload = JSON.stringify({ type: 'logout', at: 123 });
    const event = new StorageEvent('storage', {
      key: STORAGE_KEY,
      newValue: payload,
    });

    window.dispatchEvent(event);

    expect(handler).not.toHaveBeenCalled();
  });

  test('broadcastSessionEvent handles localStorage errors gracefully', () => {
    // Mock localStorage.setItem to throw
    const originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = jest.fn(() => {
      throw new Error('QuotaExceededError');
    });

    // Should not throw
    expect(() => broadcastSessionEvent('logout')).not.toThrow();

    // Restore
    Storage.prototype.setItem = originalSetItem;
  });

  test('subscribeSessionEvents is SSR-safe', () => {
    const originalWindow = global.window;
    // @ts-expect-error Remove window
    delete (global as any).window;

    const handler = jest.fn();
    const unsubscribe = subscribeSessionEvents(handler);

    // Should return no-op function
    expect(typeof unsubscribe).toBe('function');
    expect(() => unsubscribe()).not.toThrow();

    // Restore
    (global as any).window = originalWindow;
  });

  test('broadcastSessionEvent is SSR-safe', () => {
    const originalWindow = global.window;
    // @ts-expect-error Remove window
    delete (global as any).window;

    // Should not throw
    expect(() => broadcastSessionEvent('logout')).not.toThrow();

    // Restore
    (global as any).window = originalWindow;
  });
});
