import { Injectable, UnauthorizedException, NotFoundException } from '@nestjs/common';
import { LoginDto, PinLoginDto, MsrSwipeDto, AuthResponse } from '../../src/auth/dto/auth.dto';

@Injectable()
export class MockAuthService {
  async login(loginDto: LoginDto): Promise<AuthResponse> {
    if (loginDto.email === 'demo@chefcloud.dev' && loginDto.password === 'demo123') {
      return {
        access_token: 'TEST_ACCESS_TOKEN',
        user: {
          id: 'usr_demo',
          email: 'demo@chefcloud.dev',
          firstName: 'Demo',
          lastName: 'User',
          roleLevel: 'L5',
          orgId: 'org_demo',
          branchId: 'branch_demo',
        },
      };
    }
    throw new UnauthorizedException('Invalid credentials');
  }

  async pinLogin(pinLoginDto: PinLoginDto): Promise<AuthResponse> {
    if (
      pinLoginDto.employeeCode === 'EMP001' &&
      pinLoginDto.pin === '1234' &&
      pinLoginDto.branchId === 'branch_demo'
    ) {
      return {
        access_token: 'TEST_PIN_ACCESS_TOKEN',
        user: {
          id: 'usr_emp001',
          email: 'emp001@chefcloud.dev',
          firstName: 'Employee',
          lastName: '001',
          roleLevel: 'L3',
          orgId: 'org_demo',
          branchId: 'branch_demo',
        },
      };
    }
    throw new UnauthorizedException('Invalid employee code or PIN not set');
  }

  async msrSwipe(msrSwipeDto: MsrSwipeDto): Promise<AuthResponse> {
    if (msrSwipeDto.badgeId === 'CLOUDBADGE:TESTBADGE001') {
      return {
        access_token: 'TEST_BADGE_ACCESS_TOKEN',
        user: {
          id: 'usr_badge001',
          email: 'badge001@chefcloud.dev',
          firstName: 'Badge',
          lastName: 'User',
          roleLevel: 'L3',
          orgId: 'org_demo',
          branchId: 'branch_demo',
        },
      };
    }
    throw new NotFoundException('Badge ID not found');
  }

  async enrollBadge(
    _userId: string,
    _badgeId: string,
    _requestingUserId: string,
  ): Promise<{ success: boolean }> {
    return { success: true };
  }
}
