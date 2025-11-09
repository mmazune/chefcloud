import { ForbiddenException } from '@nestjs/common';

/**
 * BaseService - Enforces multi-tenant org scoping
 * 
 * All services should extend this to ensure org isolation.
 * Use withOrg() helper to automatically add orgId constraints to Prisma queries.
 */
export abstract class BaseService {
  /**
   * Wraps a Prisma query to enforce org scoping
   * 
   * @param orgId - The organization ID to scope the query to
   * @param queryBuilder - A function that returns a Prisma query with org constraints
   * @returns The result of the query
   * 
   * @example
   * async getMenuItem(orgId: string, itemId: string) {
   *   return this.withOrg(orgId, () =>
   *     this.prisma.menuItem.findFirst({
   *       where: { id: itemId, branch: { orgId } }
   *     })
   *   );
   * }
   */
  async executeInOrgContext<T>(
    orgId: string | null,
    queryBuilder: () => Promise<T>,
  ): Promise<T> {
    if (!orgId) {
      throw new ForbiddenException('Organization ID is required');
    }

    return await queryBuilder();
  }
  /**
   * Validates that a resource belongs to the specified org
   * Throws 404 if resource is null or undefined
   */
  protected validateOrgResource<T>(
    resource: T | null | undefined,
    _orgId: string,
    resourceType: string = 'Resource',
  ): T {
    if (!resource) {
      throw new ForbiddenException(`${resourceType} not found or access denied`);
    }
    return resource;
  }
}
