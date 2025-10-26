// Authentication and Authorization utilities
// RBAC/ABAC policy enforcement

export enum UserLevel {
  L1_WAITER = 1,
  L2_CASHIER = 2,
  L3_CHEF = 3,
  L4_MANAGER = 4,
  L5_OWNER = 5,
}

export interface AuthContext {
  userId: string;
  orgId: string;
  branchId?: string;
  level: UserLevel;
  permissions: string[];
}

export const hasPermission = (
  context: AuthContext,
  resource: string,
  action: string,
): boolean => {
  const permission = `${resource}:${action}`;
  return context.permissions.includes(permission);
};

export const requireLevel = (context: AuthContext, minLevel: UserLevel): boolean => {
  return context.level >= minLevel;
};

export const canVoidOrder = (context: AuthContext): boolean => {
  return requireLevel(context, UserLevel.L2_CASHIER) && hasPermission(context, 'orders', 'void');
};

export const canApplyDiscount = (context: AuthContext, amount: number): boolean => {
  // Discounts > 10% require manager approval
  if (amount > 10) {
    return requireLevel(context, UserLevel.L4_MANAGER);
  }
  return requireLevel(context, UserLevel.L2_CASHIER);
};
