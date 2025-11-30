// apps/web/jest.setup.ts
import '@testing-library/jest-dom';

// Simple localStorage mock if not provided by jsdom
if (typeof window !== 'undefined' && !window.localStorage) {
  const store: Record<string, string> = {};
  // @ts-ignore
  window.localStorage = {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      Object.keys(store).forEach(k => delete store[k]);
    },
    length: Object.keys(store).length,
    key: (index: number) => Object.keys(store)[index] || null,
  };
}

// Mock fetch globally
global.fetch = jest.fn(() =>
  Promise.resolve({
    ok: true,
    json: async () => ({}),
    text: async () => '',
  } as any)
);

// M26-EXT1: Mock crypto.randomUUID for split bill tests
if (typeof crypto === 'undefined') {
  // @ts-ignore
  global.crypto = {};
}
if (typeof crypto.randomUUID === 'undefined') {
  // Simple UUID v4 implementation for tests
  // @ts-ignore - Type mismatch between test mock and actual crypto API
  crypto.randomUUID = () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };
}
