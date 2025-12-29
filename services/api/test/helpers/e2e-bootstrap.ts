import { Test, TestingModule, TestingModuleBuilder } from '@nestjs/testing';
import { ModuleMetadata } from '@nestjs/common';

/**
 * Create an E2E testing module with standard configuration.
 * This is a thin wrapper around Test.createTestingModule() for consistency.
 * 
 * @param metadata - Module metadata (imports, providers, controllers, etc.)
 * @returns TestingModule instance
 */
export async function createE2ETestingModule(
  metadata: ModuleMetadata,
): Promise<TestingModule> {
  const moduleBuilder = Test.createTestingModule(metadata);
  return moduleBuilder.compile();
}

/**
 * Create an E2E testing module builder for advanced configuration.
 * Use this when you need to override providers, mock dependencies, etc.
 * 
 * @param metadata - Module metadata (imports, providers, controllers, etc.)
 * @returns TestingModuleBuilder instance (call .compile() to finalize)
 */
export function createE2ETestingModuleBuilder(
  metadata: ModuleMetadata,
): TestingModuleBuilder {
  return Test.createTestingModule(metadata);
}
