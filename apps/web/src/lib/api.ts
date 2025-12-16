import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

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
 * Request interceptor to attach auth token
 */
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

/**
 * Response interceptor to handle auth errors
 */
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Token expired or invalid - redirect to login
      Cookies.remove('auth_token');
      
      // Avoid redirect loop if already on login page or public endpoints
      if (typeof window !== 'undefined') {
        const currentPath = window.location.pathname;
        const isPublicPath = currentPath === '/login' || 
                           currentPath.startsWith('/public/') ||
                           currentPath === '/';
        
        if (!isPublicPath) {
          window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
        }
      }
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
