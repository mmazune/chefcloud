# Frontend API Integration Report

**Report Date:** December 14, 2025  
**Monorepo:** ChefCloud Restaurant Management System  
**Backend API:** NestJS (services/api)  
**Analysis Scope:** Complete frontend architecture and backend API targeting

---

## A) Frontend App Location + Framework/Routing

### Monorepo Structure

```
apps/
├── desktop/        # Tauri desktop app (Vite + React)
├── mobile/         # Expo/React Native mobile app  
└── web/           # Next.js web application (PRIMARY FRONTEND)

services/
├── api/           # NestJS REST API (PORT 3001)
├── sync/          # Sync service (PORT 3003)
└── worker/        # BullMQ background workers
```

### Primary Frontend: apps/web

**Framework:** Next.js 14.1.0  
**Routing:** Pages Router (uses `src/pages/` directory)  
**UI Library:** React 18.2.0  
**State Management:** TanStack Query v5.90.10  
**HTTP Client:** Axios 1.13.2  
**Form Management:** React Hook Form 7.66.1 + Zod 3.22.4  
**Styling:** Tailwind CSS 3.4.1 + Radix UI components  

**Key Dependencies:**
- `@tanstack/react-query` - Server state management, caching, invalidation
- `axios` - HTTP client with interceptors
- `js-cookie` - Cookie management for auth tokens
- `@hookform/resolvers` + `zod` - Form validation
- `@radix-ui/*` - Accessible UI primitives
- `socket.io-client` - Real-time WebSocket support
- `@simplewebauthn/browser` - WebAuthn/passkey authentication

**Routing Structure:**
- Pages Router with `src/pages/_app.tsx` as root
- Main routes: `/dashboard`, `/pos`, `/kds`, `/inventory`, `/hr`, `/finance`, `/analytics`, `/dev`
- Nested routing via directory structure (e.g., `/pages/analytics/`, `/pages/reports/`)

---

## B) API Base URL Source of Truth

### Single Source: `/apps/web/src/lib/api.ts`

**File:** [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts)

```typescript
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
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);
```

**Key Configuration:**
- **Base URL:** `process.env.NEXT_PUBLIC_API_URL` with fallback to `http://localhost:3001`
- **CORS:** `withCredentials: true` - sends cookies with cross-origin requests
- **Auth:** JWT token from cookie attached via request interceptor
- **Error Handling:** Auto-redirects to login on 401 responses

**Usage Pattern:**
```typescript
import { apiClient } from '@/lib/api';

// Example GET request
const response = await apiClient.get<UserData>('/users/me');

// Example POST request
const result = await apiClient.post('/orders', orderData);
```

### Secondary API Clients (Specialized Use Cases)

**1. Developer Portal API** - [apps/web/src/lib/devPortalApi.ts](apps/web/src/lib/devPortalApi.ts)
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchDevApiKeys(): Promise<DevApiKeyDto[]> {
  const res = await fetch(`${API_URL}/dev/keys`, {
    credentials: 'include',  // Same as withCredentials
  });
  return handleJson<DevApiKeyDto[]>(res);
}
```
- Uses native `fetch()` instead of Axios
- Same base URL environment variable
- Uses `credentials: 'include'` for cookie-based auth

**2. Franchise Analytics API** - [apps/web/src/lib/franchiseAnalyticsApi.ts](apps/web/src/lib/franchiseAnalyticsApi.ts)
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export async function fetchFranchiseBudgets(...): Promise<...> {
  const res = await fetch(`${API_URL}/franchise/budgets?${qs}`, {
    credentials: 'include',
  });
  // ...
}
```
- Same pattern as devPortalApi
- Specialized for franchise analytics endpoints

**3. POS Direct Fetch Calls** - [apps/web/src/pages/pos/index.tsx](apps/web/src/pages/pos/index.tsx)
```typescript
// POS uses direct fetch() calls with relative URLs
const res = await fetch('/api/pos/orders', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${localStorage.getItem('token')}`,
    'X-Idempotency-Key': idempotencyKey,
  },
  body: JSON.stringify(body),
});
```
- **IMPORTANT:** POS uses **relative URLs** (`/api/*`) instead of absolute URLs
- Relies on Next.js API routes or same-origin deployment
- Uses `localStorage.getItem('token')` instead of cookies (⚠️ **INCONSISTENCY**)
- Implements idempotency keys for offline queue replay

---

## C) Auth Attachment Mechanism

### **CRITICAL FINDING: Mixed Auth Strategy**

The application uses **TWO DIFFERENT auth mechanisms** depending on the code path:

### 1. Cookie-Based Auth (Primary - Recommended)

**Files:**
- [apps/web/src/lib/api.ts](apps/web/src/lib/api.ts) - Axios client
- [apps/web/src/lib/auth.ts](apps/web/src/lib/auth.ts) - Auth helper functions
- [apps/web/src/contexts/AuthContext.tsx](apps/web/src/contexts/AuthContext.tsx) - Auth state

**Token Storage:**
```typescript
// apps/web/src/lib/auth.ts
const AUTH_TOKEN_KEY = 'auth_token';

export function setAuthToken(token: string): void {
  Cookies.set(AUTH_TOKEN_KEY, token, {
    expires: 1, // 1 day
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

export function getAuthToken(): string | undefined {
  return Cookies.get(AUTH_TOKEN_KEY);
}
```

**Token Attachment:**
```typescript
// apps/web/src/lib/api.ts
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);
```

**Login Flow:**
```typescript
// apps/web/src/lib/auth.ts
export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  const { token, user } = response.data;
  setAuthToken(token); // Stores in cookie
  return user;
}
```

**Login Endpoint:** `POST /auth/login`  
**Response:**
```typescript
{
  token: string;  // JWT token
  user: AuthUser;
}
```

**Advantages:**
- ✅ Centralized in `apiClient`
- ✅ Secure (HttpOnly possible in production)
- ✅ SameSite protection against CSRF
- ✅ Auto-expires after 1 day

### 2. localStorage Auth (POS/Security Pages - ⚠️ INCONSISTENT)

**Files:**
- [apps/web/src/pages/pos/index.tsx](apps/web/src/pages/pos/index.tsx) - POS interface
- [apps/web/src/pages/security.tsx](apps/web/src/pages/security.tsx) - WebAuthn page

**Token Storage:**
```typescript
// apps/web/src/pages/security.tsx
const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

// Store JWT token
localStorage.setItem('authToken', data.token);
```

**Token Attachment:**
```typescript
// apps/web/src/pages/pos/index.tsx
const res = await fetch('/api/pos/orders', {
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`,
  },
});
```

**Issues:**
- ❌ Different storage key (`authToken` vs `auth_token`)
- ❌ localStorage is vulnerable to XSS
- ❌ No automatic expiry
- ❌ Inconsistent with primary auth pattern

### 3. Offline Queue + Idempotency

**File:** [apps/web/src/lib/offlineQueue.ts](apps/web/src/lib/offlineQueue.ts)

```typescript
export type QueuedRequest = {
  id: string;
  url: string;
  method: 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  idempotencyKey: string;  // For safe replay
  createdAt: number;
};
```

**Idempotency Key Generation:**
```typescript
// apps/web/src/pages/pos/index.tsx
const idempotencyKey = generateIdempotencyKey('pos-create');

const res = await fetch(url, {
  headers: {
    'X-Idempotency-Key': idempotencyKey,
  },
});
```

**Purpose:**
- Ensures POS mutations can be safely replayed when coming back online
- Backend must support `X-Idempotency-Key` header
- Prevents duplicate orders/payments after network reconnection

---

## D) Environment Variables Used

### Required Environment Variables

**File:** `.env.example` (root) - Shows backend config  
**Frontend Config:** Must be set in `apps/web/.env.local` (not committed)

### Frontend-Specific Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API base URL | `http://localhost:3001` | ✅ Yes |
| `NEXT_PUBLIC_API_BASE_URL` | Alternative API URL (WebAuthn) | `http://localhost:3001` | ⚠️ Inconsistent |
| `NEXT_PUBLIC_APP_ENV` | Environment indicator | `development` | No |
| `NEXT_PUBLIC_APP_VERSION` | App version display | - | No |
| `NEXT_PUBLIC_ENABLE_POS_SW` | Enable POS service worker | - | No |
| `NEXT_PUBLIC_POS_CACHE_MAX_AGE_HOURS` | IndexedDB cache duration | `24` | No |
| `NEXT_PUBLIC_SESSION_IDLE_MINUTES` | Session timeout duration | `15` | No |
| `NEXT_PUBLIC_SESSION_IDLE_WARNING_MINUTES` | Timeout warning | `2` | No |
| `NEXT_PUBLIC_ENABLE_IDLE_TIMEOUT` | Enable idle timeout | - | No |
| `NEXT_PUBLIC_DEV_DOCS_URL` | Dev portal docs link | - | No |
| `NEXT_PUBLIC_SANDBOX_API_BASE_URL` | Sandbox environment URL | - | No |
| `NEXT_PUBLIC_PRODUCTION_API_BASE_URL` | Production environment URL | - | No |

### Backend Environment Variables

| Variable | Purpose | Default | Required |
|----------|---------|---------|----------|
| `DATABASE_URL` | PostgreSQL connection | - | ✅ Yes |
| `REDIS_URL` | Redis connection URL | `redis://localhost:6379` | ✅ Yes (production) |
| `JWT_SECRET` | JWT signing secret | - | ✅ Yes |
| `API_PORT` | API server port | `3001` | No |
| `NODE_ENV` | Environment mode | `development` | No |

**Example Configuration:**

```bash
# apps/web/.env.local (frontend)
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_APP_ENV=development

# .env (backend - root)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/chefcloud"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key-here"
API_PORT="3001"
```

### Where Variables Are Referenced

**1. Main API Client** - `apps/web/src/lib/api.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

**2. Dev Portal API** - `apps/web/src/lib/devPortalApi.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

**3. Franchise Analytics API** - `apps/web/src/lib/franchiseAnalyticsApi.ts`:
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
```

**4. Security/WebAuthn Page** - `apps/web/src/pages/security.tsx`:
```typescript
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';
```

**5. Auth Token Config** - `apps/web/src/lib/auth.ts`:
```typescript
Cookies.set(AUTH_TOKEN_KEY, token, {
  secure: process.env.NODE_ENV === 'production',
});
```

**6. Service Worker** - `apps/web/src/lib/registerPosServiceWorker.ts`:
```typescript
if (process.env.NEXT_PUBLIC_ENABLE_POS_SW === 'false') return;
```

---

## E) Red Flags for Production Deployment

### 🔴 CRITICAL Issues

#### 1. **Mixed Auth Token Storage** (Security Vulnerability)

**Issue:**
- Primary auth uses `Cookies.get('auth_token')` 
- POS pages use `localStorage.getItem('token')`
- Security page uses `localStorage.getItem('authToken')`

**Impact:**
- ❌ localStorage is vulnerable to XSS attacks
- ❌ Different storage keys cause auth inconsistency
- ❌ Cookie-based auth won't work for POS endpoints

**Fix Required:**
```typescript
// Standardize all code to use cookie-based auth
// Remove all localStorage.getItem('token') calls
// Use apiClient.interceptors everywhere
```

#### 2. **Inconsistent API URL Variables**

**Issue:**
- Most code uses `NEXT_PUBLIC_API_URL`
- Security page uses `NEXT_PUBLIC_API_BASE_URL`

**Impact:**
- ❌ Confusing for deployment configuration
- ❌ Risk of pointing to wrong backend in production

**Fix Required:**
```typescript
// Standardize to NEXT_PUBLIC_API_URL everywhere
// Remove NEXT_PUBLIC_API_BASE_URL references
```

#### 3. **Relative URLs in POS** (Deployment Risk)

**Issue:**
```typescript
// apps/web/src/pages/pos/index.tsx
const res = await fetch('/api/pos/orders', { /* ... */ });
```

**Impact:**
- ❌ Assumes Next.js and API are on same origin
- ❌ Won't work if web app is on different domain (e.g., Vercel)
- ❌ Requires Next.js API routes or reverse proxy

**Current Architecture:**
```
Frontend (Vercel):     https://app.chefcloud.com
Backend (Render):      https://api.chefcloud.com

❌ Relative /api/pos/orders → Goes to Vercel, not Render
```

**Fix Required:**
```typescript
// Use absolute URLs everywhere
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const res = await fetch(`${API_URL}/pos/orders`, { /* ... */ });
```

### ⚠️ WARNING Issues

#### 4. **CORS Configuration Required**

**Current:**
```typescript
// apps/web/src/lib/api.ts
withCredentials: true,  // Axios
credentials: 'include', // fetch()
```

**Requirement:**
Backend must set CORS headers:
```typescript
// services/api/src/main.ts (NestJS)
app.enableCors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
});
```

**Without proper CORS:**
- ❌ Browser blocks requests
- ❌ Cookies won't be sent

#### 5. **Cookie Security Settings**

**Current:**
```typescript
Cookies.set(AUTH_TOKEN_KEY, token, {
  expires: 1,
  sameSite: 'strict',
  secure: process.env.NODE_ENV === 'production',
});
```

**Issues:**
- `sameSite: 'strict'` prevents cross-origin requests
- Should use `sameSite: 'lax'` or `'none'` for separate domains

**Production Fix:**
```typescript
Cookies.set(AUTH_TOKEN_KEY, token, {
  expires: 1,
  sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
  secure: true, // Always true in production
  domain: '.chefcloud.com', // Allow subdomains
});
```

#### 6. **No Environment Validation**

**Issue:**
- No validation that `NEXT_PUBLIC_API_URL` is set
- Silently falls back to localhost in production

**Fix Required:**
```typescript
const API_URL = process.env.NEXT_PUBLIC_API_URL;

if (!API_URL && typeof window !== 'undefined') {
  throw new Error('NEXT_PUBLIC_API_URL is not configured');
}
```

### 📊 INFO Issues

#### 7. **Multiple API Client Patterns**

**Current:**
- `apiClient` (Axios) - Most pages
- `fetch()` with `credentials: 'include'` - Dev portal, analytics
- `fetch()` with manual Authorization header - POS

**Recommendation:**
- Standardize on Axios + apiClient
- Or create a unified fetch wrapper
- Document which pattern to use when

#### 8. **Idempotency Key Strategy**

**Current:**
```typescript
// POS pages generate idempotency keys client-side
const idempotencyKey = generateIdempotencyKey('pos-create');
```

**Verification Needed:**
- ✅ Backend supports `X-Idempotency-Key` header
- ✅ Keys are stored for replay protection
- ✅ Key format matches backend expectations

---

## Summary & Recommendations

### Current State

**✅ Strengths:**
- Well-structured monorepo with clear separation
- Modern tech stack (Next.js 14, React 18, TanStack Query)
- Cookie-based auth implemented correctly in primary flows
- Offline queue system for POS resilience
- Type-safe contracts via workspace packages

**❌ Critical Fixes Needed:**
1. **Remove all localStorage auth** - migrate to cookies everywhere
2. **Fix relative URLs in POS** - use absolute URLs with `NEXT_PUBLIC_API_URL`
3. **Standardize API URL variable** - remove `NEXT_PUBLIC_API_BASE_URL`
4. **Configure CORS properly** - ensure backend allows frontend origin
5. **Fix cookie SameSite** - use `none` for cross-domain production

### Deployment Checklist

**Before Production:**

- [ ] Audit all `localStorage.getItem('token')` calls
- [ ] Replace relative `/api/*` URLs with absolute URLs
- [ ] Set `NEXT_PUBLIC_API_URL` in Vercel environment variables
- [ ] Configure CORS in NestJS with production frontend URL
- [ ] Update cookie settings for cross-domain auth
- [ ] Add environment variable validation
- [ ] Test auth flow end-to-end across domains
- [ ] Verify idempotency keys work in backend
- [ ] Test offline queue replay mechanism
- [ ] Ensure HTTPS is enforced for secure cookies

**Environment Variables (Production):**
```bash
# Vercel (Frontend)
NEXT_PUBLIC_API_URL=https://api.chefcloud.com
NODE_ENV=production

# Render (Backend)
FRONTEND_URL=https://app.chefcloud.com
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
JWT_SECRET=<secure-random-string>
```

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────┐
│                    apps/web (Next.js)                   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Browser (https://app.chefcloud.com)              │   │
│  │ ┌────────────────────────────────────────────┐   │   │
│  │ │ AuthContext + Cookie (auth_token)          │   │   │
│  │ └────────────────────────────────────────────┘   │   │
│  │                     │                             │   │
│  │                     ▼                             │   │
│  │ ┌────────────────────────────────────────────┐   │   │
│  │ │ apiClient (Axios + Interceptors)           │   │   │
│  │ │ baseURL: NEXT_PUBLIC_API_URL               │   │   │
│  │ │ withCredentials: true                      │   │   │
│  │ └────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                            │
                            │ HTTPS + Cookies
                            ▼
┌─────────────────────────────────────────────────────────┐
│              services/api (NestJS)                      │
│              https://api.chefcloud.com:3001             │
│  ┌──────────────────────────────────────────────────┐   │
│  │ CORS: origin = https://app.chefcloud.com         │   │
│  │ credentials: true                                │   │
│  └──────────────────────────────────────────────────┘   │
│  ┌──────────────────────────────────────────────────┐   │
│  │ Routes:                                          │   │
│  │ POST /auth/login → JWT token                    │   │
│  │ POST /auth/pin-login → JWT token                │   │
│  │ GET  /auth/me → User info                       │   │
│  │ POST /pos/orders (idempotency)                  │   │
│  │ GET  /dev/keys (developer portal)               │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Code Excerpts

### API Client Creation

```typescript
// apps/web/src/lib/api.ts (SINGLE SOURCE OF TRUTH)
import axios, { AxiosInstance, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export const apiClient: AxiosInstance = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = Cookies.get('auth_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  }
);

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      Cookies.remove('auth_token');
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = `/login?redirect=${encodeURIComponent(window.location.pathname)}`;
      }
    }
    return Promise.reject(error);
  }
);
```

### Auth Interceptor + Login Call

```typescript
// apps/web/src/lib/auth.ts
import Cookies from 'js-cookie';
import { apiClient } from './api';

const AUTH_TOKEN_KEY = 'auth_token';
const TOKEN_EXPIRY_DAYS = 1;

export function setAuthToken(token: string): void {
  Cookies.set(AUTH_TOKEN_KEY, token, {
    expires: TOKEN_EXPIRY_DAYS,
    sameSite: 'strict',
    secure: process.env.NODE_ENV === 'production',
  });
}

export async function login(credentials: LoginCredentials): Promise<AuthUser> {
  const response = await apiClient.post<LoginResponse>('/auth/login', credentials);
  const { token, user } = response.data;
  setAuthToken(token);
  return user;
}

export async function getCurrentUser(): Promise<AuthUser> {
  const response = await apiClient.get<AuthUser>('/auth/me');
  return response.data;
}
```

### Login Component

```typescript
// apps/web/src/pages/login.tsx (excerpt)
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const { login } = useAuth();
  
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const credentials: LoginCredentials = { email, password };
      await login(credentials); // Calls auth.ts → /auth/login
    } catch (err: any) {
      setError(err.response?.data?.message || 'Login failed');
    }
  };
  
  // ...
}
```

---

**End of Report**
