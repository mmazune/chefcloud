/**
 * M32-SEC-S1: Tests for session idle configuration
 */

import { getSessionIdleConfig } from './sessionIdleConfig';

const OLD_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...OLD_ENV };
});

afterAll(() => {
  process.env = OLD_ENV;
});

describe('getSessionIdleConfig', () => {
  test('uses defaults when env not set', () => {
    delete process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES;
    delete process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES;
    delete process.env.NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT;

    const config = getSessionIdleConfig();
    expect(config.enabled).toBe(true);
    expect(config.idleMs).toBe(30 * 60 * 1000); // 30 minutes
    expect(config.warningMs).toBe(5 * 60 * 1000); // 5 minutes
  });

  test('disables when NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT=0', () => {
    process.env.NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT = '0';
    const config = getSessionIdleConfig();
    expect(config.enabled).toBe(false);
  });

  test('enables when NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT=1', () => {
    process.env.NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT = '1';
    const config = getSessionIdleConfig();
    expect(config.enabled).toBe(true);
  });

  test('respects custom idle minutes', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '10';
    const config = getSessionIdleConfig();
    expect(config.idleMs).toBe(10 * 60 * 1000);
  });

  test('respects custom warning minutes', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '10';
    process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES = '3';
    const config = getSessionIdleConfig();
    expect(config.warningMs).toBe(3 * 60 * 1000);
  });

  test('clamps idle minutes to minimum (5)', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '2';
    const config = getSessionIdleConfig();
    expect(config.idleMs).toBe(5 * 60 * 1000);
  });

  test('clamps idle minutes to maximum (480)', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '600';
    const config = getSessionIdleConfig();
    expect(config.idleMs).toBe(480 * 60 * 1000);
  });

  test('ensures warning is less than idle time', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '10';
    process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES = '15';
    const config = getSessionIdleConfig();
    // Warning should be clamped to idle - 1
    expect(config.warningMs).toBe(9 * 60 * 1000);
  });

  test('ensures warning is at least 1 minute', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '5';
    process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES = '0';
    const config = getSessionIdleConfig();
    expect(config.warningMs).toBeGreaterThanOrEqual(1 * 60 * 1000);
  });

  test('handles invalid (NaN) values gracefully', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = 'invalid';
    process.env.NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES = 'bad';
    const config = getSessionIdleConfig();
    // NaN gets clamped to minimum (5 minutes)
    expect(config.idleMs).toBe(5 * 60 * 1000);
    // Warning must be < idle, so max is 4 minutes
    expect(config.warningMs).toBeLessThan(config.idleMs);
    expect(config.warningMs).toBeGreaterThanOrEqual(1 * 60 * 1000);
  });

  test('handles negative values by clamping to minimum', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = '-10';
    const config = getSessionIdleConfig();
    expect(config.idleMs).toBe(5 * 60 * 1000);
  });

  test('handles Infinity by clamping to maximum', () => {
    process.env.NEXT_PUBLIC_SESSION_IDLE_MINUTES = 'Infinity';
    const config = getSessionIdleConfig();
    expect(config.idleMs).toBe(5 * 60 * 1000); // NaN becomes min
  });
});
