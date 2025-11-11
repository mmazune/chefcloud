import { Injectable } from '@nestjs/common';

@Injectable()
export class MockMeService {
  async getMe(userId: string) {
    if (userId === 'usr_demo') {
      return {
        id: 'usr_demo',
        email: 'demo@chefcloud.dev',
        firstName: 'Demo',
        lastName: 'User',
        roleLevel: 'L5',
        orgId: 'org_demo',
        branchId: 'branch_demo',
        isActive: true,
        org: {
          id: 'org_demo',
          name: 'Demo Org',
          slug: 'demo-org',
        },
        branch: {
          id: 'branch_demo',
          name: 'Demo Branch',
          timezone: 'UTC',
        },
        employeeProfile: null,
      };
    }
    return null;
  }
}
