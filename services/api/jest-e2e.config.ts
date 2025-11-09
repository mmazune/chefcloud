import { pathsToModuleNameMapper } from 'ts-jest';
import baseTs from '../../tsconfig.base.json';

export default {
  preset: 'ts-jest',
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/test/e2e/**/*.e2e-spec.ts'],
  setupFilesAfterEnv: ['<rootDir>/jest-e2e.setup.ts'],
  transform: {
    '^.+\\.tsx?$': [
      'ts-jest',
      {
        isolatedModules: false,
        tsconfig: '<rootDir>/tsconfig.e2e.json',
      },
    ],
  },
  // CRITICAL: prefer src over dist and ignore built outputs
  moduleDirectories: ['node_modules', '<rootDir>/src'],
  modulePathIgnorePatterns: [
    '<rootDir>/dist',
    '<rootDir>/../../services/api/dist',
    '<rootDir>/../../packages/.*/dist',
  ],
  testPathIgnorePatterns: ['/dist/', '/node_modules/', '\\.spec\\.ts$'],
  // Map TS path aliases to repo sources (never dist)
  moduleNameMapper: {
    ...pathsToModuleNameMapper((baseTs as any).compilerOptions?.paths || {}, {
      prefix: '<rootDir>/../../',
    }),
    // Hard guard: anything ending with /dist/* → /src/*
    '^(.*)/dist/(.*)$': '$1/src/$2',
  },
  maxWorkers: '50%',
};
