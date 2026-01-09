/**
 * E2E Test Credentials - Single Source of Truth
 *
 * MUST match prisma/demo/constants.ts seed data exactly.
 * All demo users share the same password: Demo#123
 *
 * DO NOT hardcode credentials in individual test files.
 * Import from this file instead.
 *
 * @see services/api/prisma/demo/constants.ts
 * @see services/api/prisma/demo/seedDemo.ts
 */

/**
 * Shared password for ALL demo users
 */
export const E2E_DEMO_PASSWORD = 'Demo#123';

/**
 * Tapas Bar & Restaurant demo users
 */
export const TAPAS_CREDENTIALS = {
  owner: {
    email: 'owner@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L5',
    firstName: 'Joshua',
    lastName: 'Owner',
  },
  manager: {
    email: 'manager@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L4',
    firstName: 'Bob',
    lastName: 'Manager',
    pin: '1234',
  },
  accountant: {
    email: 'accountant@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L4',
    firstName: 'Carol',
    lastName: 'Accountant',
  },
  procurement: {
    email: 'procurement@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L3',
    firstName: 'Dan',
    lastName: 'Procurement',
  },
  stock: {
    email: 'stock@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L3',
    firstName: 'Eve',
    lastName: 'Stock',
  },
  supervisor: {
    email: 'supervisor@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L2',
    firstName: 'Frank',
    lastName: 'Supervisor',
  },
  cashier: {
    email: 'cashier@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L2',
    firstName: 'Grace',
    lastName: 'Cashier',
  },
  waiter: {
    email: 'waiter@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L1',
    firstName: 'Henry',
    lastName: 'Waiter',
  },
  chef: {
    email: 'chef@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L2',
    firstName: 'Iris',
    lastName: 'Chef',
  },
  bartender: {
    email: 'bartender@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L1',
    firstName: 'Jack',
    lastName: 'Bartender',
  },
  eventmgr: {
    email: 'eventmgr@tapas.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L3',
    firstName: 'Kelly',
    lastName: 'Events',
  },
} as const;

/**
 * Cafesserie demo users
 */
export const CAFESSERIE_CREDENTIALS = {
  owner: {
    email: 'owner@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L5',
    firstName: 'Joshua',
    lastName: 'Owner',
  },
  manager: {
    email: 'manager@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L4',
    firstName: 'Mike',
    lastName: 'Manager',
    pin: '5678',
  },
  accountant: {
    email: 'accountant@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L4',
    firstName: 'Nina',
    lastName: 'Accountant',
  },
  procurement: {
    email: 'procurement@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L3',
    firstName: 'Oscar',
    lastName: 'Procurement',
  },
  supervisor: {
    email: 'supervisor@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L2',
    firstName: 'Paula',
    lastName: 'Supervisor',
  },
  cashier: {
    email: 'cashier@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L2',
    firstName: 'Quinn',
    lastName: 'Cashier',
  },
  waiter: {
    email: 'waiter@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L1',
    firstName: 'Rachel',
    lastName: 'Waiter',
  },
  chef: {
    email: 'chef@cafesserie.demo.local',
    password: E2E_DEMO_PASSWORD,
    roleLevel: 'L2',
    firstName: 'Sam',
    lastName: 'Chef',
  },
} as const;

/**
 * Org slugs (for x-org-id headers)
 * MUST match prisma/demo/constants.ts exactly
 */
export const DEMO_ORG_SLUGS = {
  tapas: 'tapas-demo',
  cafesserie: 'cafesserie-demo',
} as const;

/**
 * Dataset configurations - ties credentials to their org context
 */
export const DEMO_DATASETS = {
  DEMO_TAPAS: {
    slug: 'tapas-demo',
    orgId: '00000000-0000-4000-8000-000000000001', // Deterministic ID from seed
    credentials: TAPAS_CREDENTIALS,
  },
  DEMO_CAFESSERIE_FRANCHISE: {
    slug: 'cafesserie-demo',
    orgId: '00000000-0000-4000-8000-000000000002', // Deterministic ID from seed
    credentials: CAFESSERIE_CREDENTIALS,
  },
} as const;

/**
 * Common role-based credential access
 * Defaults to Tapas org for backward compatibility
 */
export const E2E_USERS = {
  owner: TAPAS_CREDENTIALS.owner,
  manager: TAPAS_CREDENTIALS.manager,
  accountant: TAPAS_CREDENTIALS.accountant,
  procurement: TAPAS_CREDENTIALS.procurement,
  stock: TAPAS_CREDENTIALS.stock,
  supervisor: TAPAS_CREDENTIALS.supervisor,
  cashier: TAPAS_CREDENTIALS.cashier,
  waiter: TAPAS_CREDENTIALS.waiter,
  chef: TAPAS_CREDENTIALS.chef,
  bartender: TAPAS_CREDENTIALS.bartender,
  eventmgr: TAPAS_CREDENTIALS.eventmgr,
} as const;

// Legacy compatibility exports (deprecated - use E2E_USERS instead)
export const E2E_CREDENTIALS = {
  OWNER: TAPAS_CREDENTIALS.owner,
  MANAGER: TAPAS_CREDENTIALS.manager,
  PROCUREMENT: TAPAS_CREDENTIALS.procurement,
  ASSISTANT_MANAGER: TAPAS_CREDENTIALS.supervisor,
  CASHIER: TAPAS_CREDENTIALS.cashier,
  SUPERVISOR: TAPAS_CREDENTIALS.supervisor,
  CHEF: TAPAS_CREDENTIALS.chef,
  WAITER: TAPAS_CREDENTIALS.waiter,
  BARTENDER: TAPAS_CREDENTIALS.bartender,
  EVENT_MANAGER: TAPAS_CREDENTIALS.eventmgr,
  HEAD_BARISTA: TAPAS_CREDENTIALS.bartender, // closest match
  TICKET_MASTER: TAPAS_CREDENTIALS.supervisor, // closest match
  ASSISTANT_CHEF: TAPAS_CREDENTIALS.chef,
} as const;

export type E2ERole =
  | 'OWNER'
  | 'MANAGER'
  | 'PROCUREMENT'
  | 'ASSISTANT_MANAGER'
  | 'EVENT_MANAGER'
  | 'HEAD_BARISTA'
  | 'SUPERVISOR'
  | 'CASHIER'
  | 'TICKET_MASTER'
  | 'ASSISTANT_CHEF'
  | 'WAITER'
  | 'CHEF'
  | 'BARTENDER';

/**
 * Badge codes for MSR authentication - org-prefixed for uniqueness
 * These MUST match the seed (prisma/demo/seedDemo.ts)
 */
export const TAPAS_BADGES = {
  manager: 'ORG1-MGR001',
  cashier: 'ORG1-CASHIER001',
  supervisor: 'ORG1-SUP001',
  waiter: 'ORG1-WAIT001',
  chef: 'ORG1-CHEF001',
} as const;

export const CAFESSERIE_BADGES = {
  manager: 'ORG2-MGR001',
  cashier: 'ORG2-CASHIER001',
  supervisor: 'ORG2-SUP001',
  waiter: 'ORG2-WAIT001',
  chef: 'ORG2-CHEF001',
} as const;

/**
 * Get credentials for a specific role
 */
export function getCredentials(role: E2ERole) {
  return E2E_CREDENTIALS[role];
}
