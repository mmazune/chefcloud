import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { recordApiCall, isApiCaptureEnabled } from '@/lib/navmap/apiCapture';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

// Debug logging
if (typeof window !== 'undefined') {
  console.log('[API Init] API_URL:', API_URL);
  console.log('[API Init] process.env.NEXT_PUBLIC_API_URL:', process.env.NEXT_PUBLIC_API_URL);
}

/**
 * Axios instance configured for ChefCloud API
 */
export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
    'X-Client-Platform': 'web',
  },
  withCredentials: true, // Include cookies in requests
});

/**
 * Decode JWT payload (without verification) to extract claims
 * Used client-side to get orgId for multi-tenant header
 */
function decodeJwtPayload(token: string): { orgId?: string; sub?: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    
    // Support both browser and Node.js environments
    let base64 = parts[1];
    // Handle URL-safe base64
    base64 = base64.replace(/-/g, '+').replace(/_/g, '/');
    
    const decoded = typeof window !== 'undefined' 
      ? atob(base64)
      : Buffer.from(base64, 'base64').toString('utf-8');
    
    const payload = JSON.parse(decoded);
    return payload;
  } catch {
    return null;
  }
}

/**
 * Request interceptor to attach auth token and org-id header
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('auth_token');
    console.log('[API] Request to:', config.url, 'Token present:', !!token);
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
      
      // Extract orgId from JWT payload for multi-tenant header
      const payload = decodeJwtPayload(token);
      if (payload?.orgId) {
        config.headers['x-org-id'] = payload.orgId;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle auth errors and log API calls
 * NOTE: We no longer auto-redirect on 401 - let ProtectedRoute handle it
 * This prevents race conditions during login/navigation
 */
apiClient.interceptors.response.use(
  (response) => {
    // Log successful API call for debug panel
    try {
      const rowCount = Array.isArray(response.data) ? response.data.length : 
                       (response.data?.data && Array.isArray(response.data.data)) ? response.data.data.length : null;
      if (typeof window !== 'undefined') {
        import('@/components/dev/DevDebugPanel').then(({ logApiCall }) => {
          logApiCall({
            method: response.config.method?.toUpperCase() || 'GET',
            path: response.config.url || '',
            status: response.status,
            rowCount,
            duration: 0, // Could be calculated with request start time
          });
        }).catch(() => { /* Ignore logging errors */ });
      }
    } catch (e) {
      // Ignore logging errors
    }
    
    // Phase I3.1: Navmap API capture
    if (isApiCaptureEnabled()) {
      try {
        recordApiCall(
          response.config.method?.toUpperCase() || 'GET',
          response.config.url || '',
          response.status
        );
      } catch {
        // Ignore capture errors
      }
    }
    
    return response;
  },
  (error) => {
    // Log failed API call
    try {
      if (typeof window !== 'undefined' && error.response) {
        import('@/components/dev/DevDebugPanel').then(({ logApiCall }) => {
          logApiCall({
            method: error.config?.method?.toUpperCase() || 'GET',
            path: error.config?.url || '',
            status: error.response?.status || 0,
            rowCount: null,
            duration: 0,
            error: error.response?.data?.message || error.message,
          });
        }).catch(() => { /* Ignore logging errors */ });
      }
    } catch (e) {
      // Ignore logging errors
    }

    if (error.response?.status === 401) {
      console.log('[API] 401 error on:', error.config?.url);
      // Don't auto-redirect - let ProtectedRoute and AuthContext handle auth state
      // Just log the error for debugging
    }
    return Promise.reject(error);
  }
);

/**
 * API response wrapper type
 */
export interface ApiResponse<T = any> {
  data: T;
  message?: string;
  error?: string;
}

/**
 * Error response type
 */
export interface ApiError {
  message: string;
  statusCode?: number;
  error?: string;
}

/**
 * Helper to extract error message from API error
 */
export function getErrorMessage(error: any): string {
  if (error.response?.data?.message) {
    return error.response.data.message;
  }
  if (error.message) {
    return error.message;
  }
  return 'An unexpected error occurred';
}

/**
 * Authenticated fetch helper for use in hooks that need raw fetch (e.g., offline-first)
 * Adds the Authorization header from the auth_token cookie
 * Also adds x-org-id header for multi-tenant isolation
 */
export async function authenticatedFetch(url: string, options: RequestInit = {}): Promise<Response> {
  const token = Cookies.get('auth_token');
  const headers = new Headers(options.headers);
  
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
    
    // Extract orgId from JWT payload for multi-tenant header
    const payload = decodeJwtPayload(token);
    if (payload?.orgId) {
      headers.set('x-org-id', payload.orgId);
    }
  }
  headers.set('Content-Type', 'application/json');
  
  return fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });
}

/**
 * Get the API base URL
 */
export const API_BASE_URL = API_URL;
