/**
 * Role hierarchy for level-based authorization.
 * Higher numbers indicate higher privileges.
 */
export const ROLE_HIERARCHY = {
  L1: 1,
  L2: 2,
  L3: 3,
  L4: 4,
  L5: 5,
} as const;

/**
 * Mapping of named role slugs to their corresponding levels.
 * This allows @Roles decorators to use semantic names like @Roles('WAITER')
 * instead of only @Roles('L1').
 */
export const ROLE_TO_LEVEL = {
  // L1 roles
  WAITER: 'L1',
  
  // L2 roles
  CASHIER: 'L2',
  SUPERVISOR: 'L2',
  TICKET_MASTER: 'L2',
  ASSISTANT_CHEF: 'L2',
  
  // L3 roles
  CHEF: 'L3',
  STOCK: 'L3',
  PROCUREMENT: 'L3',
  ASSISTANT_MANAGER: 'L3',
  EVENT_MANAGER: 'L3',
  HEAD_BARISTA: 'L3',
  
  // L4 roles
  MANAGER: 'L4',
  ACCOUNTANT: 'L4',
  
  // L5 roles (full access)
  OWNER: 'L5',
  ADMIN: 'L5',
} as const;

export type RoleLevel = keyof typeof ROLE_HIERARCHY;
export type RoleSlug = keyof typeof ROLE_TO_LEVEL;
