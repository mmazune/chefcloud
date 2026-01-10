// apps/web/jest.config.ts
import nextJest from 'next/jest.js';

const createJestConfig = nextJest({
  dir: './',
});

const customJestConfig = {
  testEnvironment: 'jsdom',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // Exclude Playwright E2E tests (run with pnpm test:e2e)
  testPathIgnorePatterns: ['/node_modules/', '/e2e/'],
};

export default createJestConfig(customJestConfig);
