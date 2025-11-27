import Cookies from 'js-cookie';
import { apiClient } from './api';

/**
 * Role levels in ChefCloud
 */
export enum RoleLevel {
  L1 = 'L1', // Waiter
  L2 = 'L2', // Cashier/Supervisor
  L3 = 'L3', // Chef/Stock
  L4 = 'L4', // Manager/Accountant
  L5 = 'L5', // Owner/Admin
}

/**
 * Authenticated user information
 */
export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  roleLevel: RoleLevel;
  org: {
    id: string;
    name: string;
  };
  branch?: {
    id: string;
    name: string;
  };
}

/**
 * Login credentials
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * PIN login credentials
 */
export interface PinLoginCredentials {
  pin: string;
  branchId?: string;
}

/**
 * Login response from API
 */
export interface LoginResponse {
  token: string;
  user: AuthUser;
}

/**
 * Auth token storage
 */
const AUTH_TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_DAYS = 1; // 1 day expiry for MVP

/**
 * Store auth token in cookie
 */
export function setAuthToken(token: string): void {
  Cookies.set(AUTH_TOKEN_KEY, token, {
    expires: TOKEN_EXPIRY_DAYS,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

/**
 * Get auth token from cookie
 */
export function getAuthToken(): string | undefined {
  return Cookies.get(AUTH_TOKEN_KEY);
}

/**
 * Remove auth token from cookie
 */
export function removeAuthToken(): void {
  Cookies.remove(AUTH_TOKEN_KEY);
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

/**
 * Login with email and password
 */
export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  const { token, user } = response.data;
  setAuthToken(token);
  return user;
}

/**
 * Login with PIN
 */
export async function pinLogin(credentials: PinLoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<LoginResponse>('/auth/pin-login', credentials);
  const { token, user } = response.data;
  setAuthToken(token);
  return user;
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  try {
    await apiClient.post('/auth/logout');
  } catch (error) {
    // Ignore errors on logout
  } finally {
    removeAuthToken();
  }
}

/**
 * Get current user information
 */
export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me');
  return response.data;
}

/**
 * Check if user has required role level
 */
export function hasRoleLevel(user: AuthUser, requiredLevel: RoleLevel): boolean {
  const levels = [RoleLevel.L1, RoleLevel.L2, RoleLevel.L3, RoleLevel.L4, RoleLevel.L5];
  const userLevelIndex = levels.indexOf(user.roleLevel);
  const requiredLevelIndex = levels.indexOf(requiredLevel);
  return userLevelIndex >= requiredLevelIndex;
}
