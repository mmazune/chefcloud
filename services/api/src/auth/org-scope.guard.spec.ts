import { ExecutionContext, BadRequestException, ForbiddenException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { OrgScopeGuard } from './org-scope.guard';

describe('OrgScopeGuard', () => {
  let guard: OrgScopeGuard;

  beforeEach(async () => {
    const module = await Test.createTestingModule({
      providers: [OrgScopeGuard],
    }).compile();

    guard = module.get<OrgScopeGuard>(OrgScopeGuard);
  });

  const createMockContext = (user: any, headers: Record<string, string>): ExecutionContext => {
    return {
      switchToHttp: () => ({
        getRequest: () => ({
          user,
          headers,
        }),
      }),
    } as ExecutionContext;
  };

  it('should allow request when x-org-id matches user orgId', () => {
    const user = { userId: 'user-1', orgId: 'org-123' };
    const context = createMockContext(user, { 'x-org-id': 'org-123' });

    expect(guard.canActivate(context)).toBe(true);
  });

  it('should throw BadRequestException when x-org-id header is missing', () => {
    const user = { userId: 'user-1', orgId: 'org-123' };
    const context = createMockContext(user, {});

    expect(() => guard.canActivate(context)).toThrow(BadRequestException);
    expect(() => guard.canActivate(context)).toThrow('Missing x-org-id header');
  });

  it('should throw ForbiddenException when x-org-id does not match user orgId', () => {
    const user = { userId: 'user-1', orgId: 'org-123' };
    const context = createMockContext(user, { 'x-org-id': 'org-999' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Access to this organization is denied');
  });

  it('should throw ForbiddenException when user is not authenticated', () => {
    const context = createMockContext(null, { 'x-org-id': 'org-123' });

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
    expect(() => guard.canActivate(context)).toThrow('Authentication required');
  });

  it('should attach validated orgId to request', () => {
    const user = { userId: 'user-1', orgId: 'org-123' };
    const request = { user, headers: { 'x-org-id': 'org-123' } };
    const context = {
      switchToHttp: () => ({
        getRequest: () => request,
      }),
    } as ExecutionContext;

    guard.canActivate(context);

    expect(request).toHaveProperty('orgId', 'org-123');
  });
});
