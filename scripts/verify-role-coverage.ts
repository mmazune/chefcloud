/**
 * M7.4 - Role Coverage Verification Script
 * 
 * Tests every demo role (Tapas + Cafesserie) to ensure:
 * 1. Login works
 * 2. /me and /branches return valid data
 * 3. branchId is NOT NULL (unless L5 Owner)
 * 4. Endpoints accessible by that role return non-empty data
 * 5. RBAC-denied endpoints return 403 (not empty 200)
 * 
 * Usage:
 *   npx tsx scripts/verify-role-coverage.ts
 *   npx tsx scripts/verify-role-coverage.ts --out path/to/output.txt
 *   npx tsx scripts/verify-role-coverage.ts --base http://localhost:3001
 *   npx tsx scripts/verify-role-coverage.ts --role owner --org tapas
 *   npx tsx scripts/verify-role-coverage.ts --org cafesserie
 */

import axios, { AxiosInstance } from 'axios';
import * as fs from 'fs';
import * as path from 'path';

// ===== CLI Argument Parsing =====
interface CLIArgs {
  out: string;
  base: string;
  role: string;
  org: 'tapas' | 'cafesserie' | 'both';
  delayMs: number;
  maxRetries: number;
}

function parseArgs(): CLIArgs {
  const args: CLIArgs = {
    out: 'instructions/M7.4_ROLE_VERIFY_OUTPUT.txt',
    base: process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE || 'http://localhost:3001',
    role: 'all',
    org: 'both',
    delayMs: 250,
    maxRetries: 4,
  };

  for (let i = 2; i < process.argv.length; i++) {
    const arg = process.argv[i];
    if (arg === '--out' && i + 1 < process.argv.length) {
      args.out = process.argv[++i];
    } else if (arg === '--base' && i + 1 < process.argv.length) {
      args.base = process.argv[++i];
    } else if (arg === '--role' && i + 1 < process.argv.length) {
      args.role = process.argv[++i].toLowerCase();
    } else if (arg === '--org' && i + 1 < process.argv.length) {
      const orgArg = process.argv[++i].toLowerCase();
      if (orgArg === 'tapas' || orgArg === 'cafesserie' || orgArg === 'both') {
        args.org = orgArg;
      }
    } else if (arg === '--delay-ms' && i + 1 < process.argv.length) {
      args.delayMs = parseInt(process.argv[++i], 10) || 250;
    } else if (arg === '--max-retries' && i + 1 < process.argv.length) {
      args.maxRetries = parseInt(process.argv[++i], 10) || 4;
    }
  }

  return args;
}

const CLI_ARGS = parseArgs();
const API_BASE = CLI_ARGS.base;
const DEMO_PASSWORD = 'Demo#123';

// ===== Role Definitions =====

const TAPAS_ROLES = [
  { email: 'owner@tapas.demo.local', roleLevel: 'L5', role: 'Owner' },
  { email: 'manager@tapas.demo.local', roleLevel: 'L4', role: 'Manager' },
  { email: 'accountant@tapas.demo.local', roleLevel: 'L4', role: 'Accountant' },
  { email: 'procurement@tapas.demo.local', roleLevel: 'L3', role: 'Procurement' },
  { email: 'stock@tapas.demo.local', roleLevel: 'L3', role: 'Stock' },
  { email: 'supervisor@tapas.demo.local', roleLevel: 'L2', role: 'Supervisor' },
  { email: 'cashier@tapas.demo.local', roleLevel: 'L2', role: 'Cashier' },
  { email: 'waiter@tapas.demo.local', roleLevel: 'L1', role: 'Waiter' },
  { email: 'chef@tapas.demo.local', roleLevel: 'L2', role: 'Chef' },
  { email: 'bartender@tapas.demo.local', roleLevel: 'L1', role: 'Bartender' },
  { email: 'eventmgr@tapas.demo.local', roleLevel: 'L3', role: 'EventMgr' },
] as const;

const CAFESSERIE_ROLES = [
  { email: 'owner@cafesserie.demo.local', roleLevel: 'L5', role: 'Owner' },
  { email: 'manager@cafesserie.demo.local', roleLevel: 'L4', role: 'Manager' },
  { email: 'accountant@cafesserie.demo.local', roleLevel: 'L4', role: 'Accountant' },
  { email: 'procurement@cafesserie.demo.local', roleLevel: 'L3', role: 'Procurement' },
  { email: 'supervisor@cafesserie.demo.local', roleLevel: 'L2', role: 'Supervisor' },
  { email: 'cashier@cafesserie.demo.local', roleLevel: 'L2', role: 'Cashier' },
  { email: 'waiter@cafesserie.demo.local', roleLevel: 'L1', role: 'Waiter' },
  { email: 'chef@cafesserie.demo.local', roleLevel: 'L2', role: 'Chef' },
] as const;

// ===== RBAC Endpoint Access Matrix =====
// Based on UI_ENDPOINT_MATRIX.md and typical RBAC patterns

interface EndpointTest {
  endpoint: string;
  method: 'GET' | 'POST';
  params?: Record<string, any>;
  minLevel: 'L1' | 'L2' | 'L3' | 'L4' | 'L5';
  description: string;
  expectEmpty?: boolean; // if true, empty response is OK
}

const COMMON_ENDPOINTS: EndpointTest[] = [
  { endpoint: '/me', method: 'GET', minLevel: 'L1', description: 'User profile' },
  { endpoint: '/menu/items', method: 'GET', minLevel: 'L1', description: 'Menu items' },
];

const L1_ENDPOINTS: EndpointTest[] = [
  // Waiters/Bartenders - POS access
  { endpoint: '/pos/orders', method: 'GET', params: { status: 'OPEN' }, minLevel: 'L1', description: 'Open orders (POS)' },
];

const L2_ENDPOINTS: EndpointTest[] = [
  // Supervisors/Cashiers/Chefs - can see more operational data
  ...L1_ENDPOINTS,
  { endpoint: '/pos/orders', method: 'GET', params: { status: 'CLOSED' }, minLevel: 'L2', description: 'Closed orders' },
];

const L3_ENDPOINTS: EndpointTest[] = [
  // Procurement/Stock - full inventory, limited analytics
  ...L2_ENDPOINTS,
  { endpoint: '/inventory/levels', method: 'GET', minLevel: 'L3', description: 'Inventory levels' },
  { endpoint: '/inventory/items', method: 'GET', minLevel: 'L3', description: 'Inventory items' },
  { endpoint: '/inventory/low-stock/alerts', method: 'GET', minLevel: 'L3', description: 'Low stock alerts' },
  { endpoint: '/analytics/daily', method: 'GET', params: { date: new Date().toISOString().split('T')[0] }, minLevel: 'L3', description: 'Daily analytics' },
  { endpoint: '/service-providers', method: 'GET', minLevel: 'L3', description: 'Service providers', expectEmpty: true },
];

const L4_ENDPOINTS: EndpointTest[] = [
  // Manager/Accountant - full analytics, reports, finance
  ...L3_ENDPOINTS,
  { endpoint: '/analytics/daily-metrics', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO() }, minLevel: 'L4', description: 'Daily metrics' },
  { endpoint: '/analytics/top-items', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO(), limit: 10 }, minLevel: 'L4', description: 'Top items' },
  { endpoint: '/analytics/category-mix', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO() }, minLevel: 'L4', description: 'Category mix' },
  { endpoint: '/analytics/payment-mix', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO() }, minLevel: 'L4', description: 'Payment mix' },
  { endpoint: '/analytics/peak-hours', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO() }, minLevel: 'L4', description: 'Peak hours' },
  { endpoint: '/analytics/financial-summary', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO() }, minLevel: 'L4', description: 'Financial summary' },
  { endpoint: '/hr/employees', method: 'GET', params: { page: 1, pageSize: 20 }, minLevel: 'L4', description: 'Employee list' },
  { endpoint: '/staff/insights', method: 'GET', minLevel: 'L4', description: 'Staff insights' },
  { endpoint: '/feedback/analytics/nps-summary', method: 'GET', params: { from: getDateDaysAgo(30), to: getTodayISO() }, minLevel: 'L4', description: 'NPS summary' },
  { endpoint: '/reservations', method: 'GET', params: { from: getDateDaysAgo(7), to: getTodayISO() }, minLevel: 'L4', description: 'Reservations', expectEmpty: true },
  { endpoint: '/debug/demo-health', method: 'GET', params: { from: getDateDaysAgo(90), to: getTodayISO() }, minLevel: 'L4', description: 'Demo health debug' },
];

const L5_ENDPOINTS: EndpointTest[] = [
  // Owner - everything + franchise endpoints (for multi-branch orgs)
  ...L4_ENDPOINTS,
];

// Franchise-specific endpoints (Cafesserie only - multi-branch)
const FRANCHISE_ENDPOINTS: EndpointTest[] = [
  { endpoint: '/franchise/rankings', method: 'GET', params: { period: getCurrentPeriod() }, minLevel: 'L5', description: 'Branch rankings' },
  { endpoint: '/franchise/analytics/overview', method: 'GET', params: { startDate: getDateDaysAgoYYYYMMDD(30), endDate: getTodayYYYYMMDD() }, minLevel: 'L4', description: 'Franchise overview' },
  { endpoint: '/franchise/branch-metrics', method: 'GET', params: { startDate: getDateDaysAgoYYYYMMDD(30), endDate: getTodayYYYYMMDD() }, minLevel: 'L4', description: 'Branch metrics' },
];

// ===== Helper Functions =====

function getTodayISO(): string {
  return new Date().toISOString();
}

function getTodayYYYYMMDD(): string {
  return new Date().toISOString().split('T')[0];
}

function getDateDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

function getDateDaysAgoYYYYMMDD(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString().split('T')[0];
}

function getCurrentPeriod(): string {
  return new Date().toISOString().slice(0, 7); // YYYY-MM
}

function getRoleLevelNum(roleLevel: string): number {
  return parseInt(roleLevel.substring(1), 10);
}

function canAccessEndpoint(userLevel: string, endpointMinLevel: string): boolean {
  return getRoleLevelNum(userLevel) >= getRoleLevelNum(endpointMinLevel);
}

// ===== File Output Management =====

let OUTPUT_FILE: string;
let OUTPUT_STREAM: fs.WriteStream;

function initOutputFile(filePath: string) {
  OUTPUT_FILE = path.resolve(filePath);
  const outputDir = path.dirname(OUTPUT_FILE);
  
  // Create directory if it doesn't exist
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  // Overwrite file with header
  const header = [
    '# M7.4 Role Coverage Verification Output',
    `Date: ${new Date().toISOString()}`,
    `API Base: ${API_BASE}`,
    `CLI Args: ${JSON.stringify(CLI_ARGS)}`,
    '',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '## VERIFICATION IN PROGRESS...',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
  ].join('\n');
  
  fs.writeFileSync(OUTPUT_FILE, header, 'utf-8');
  console.log(`📄 Output file initialized: ${OUTPUT_FILE}`);
  
  // Open stream for appending
  OUTPUT_STREAM = fs.createWriteStream(OUTPUT_FILE, { flags: 'a' });
}

function appendToOutput(text: string) {
  if (OUTPUT_STREAM) {
    OUTPUT_STREAM.write(text + '\n');
  }
}

function closeOutputFile() {
  if (OUTPUT_STREAM) {
    OUTPUT_STREAM.end();
  }
}

// ===== Test Result Types =====

interface TestResult {
  email: string;
  roleLevel: string;
  role: string;
  org: string;
  loginSuccess: boolean;
  branchId: string | null;
  branchIdError?: string;
  endpointResults: EndpointResult[];
}

interface EndpointResult {
  endpoint: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'RBAC_DENIED' | 'ERROR';
  statusCode?: number;
  recordCount?: number;
  message: string;
  details?: any;
}

const allResults: TestResult[] = [];
const summary = {
  totalPlanned: 0,
  totalExecuted: 0,
  passed: 0,
  failed: 0,
  rbacDeniedExpected: 0, // 403 when user shouldn't have access = correct behavior
  errors: 0,
  skipped: 0,
  skippedReasons: [] as string[],
  retriesFor429: 0,
};

// ===== Core Functions =====

async function login(email: string, password: string): Promise<string | null> {
  try {
    const response = await retryWithBackoff(
      () => axios.post(`${API_BASE}/auth/login`, { email, password }),
      `login ${email}`,
    );
    const token = response.data.access_token || response.data.accessToken;
    if (!token) {
      console.error(`❌ Login failed for ${email}: No token in response`, response.data);
      return null;
    }
    return token;
  } catch (error: any) {
    console.error(`❌ Login failed for ${email}: ${error.response?.data?.message || error.message}`);
    return null;
  }
}

function createClient(token: string, orgId?: string, branchId?: string): AxiosInstance {
  const headers: any = { Authorization: `Bearer ${token}` };
  if (orgId) headers['x-org-id'] = orgId;
  if (branchId) headers['x-branch-id'] = branchId;
  
  return axios.create({
    baseURL: API_BASE,
    headers,
  });
}

// ===== Retry Logic for 429 Errors =====

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  context: string,
  maxRetries: number = CLI_ARGS.maxRetries,
): Promise<T> {
  let lastError: any;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Add base delay between all requests to avoid rate limiting
      if (attempt > 0 || CLI_ARGS.delayMs > 0) {
        await sleep(CLI_ARGS.delayMs);
      }
      
      return await fn();
    } catch (error: any) {
      lastError = error;
      
      // If not 429 or last attempt, throw immediately
      if (error.response?.status !== 429 || attempt === maxRetries) {
        throw error;
      }
      
      // Track retry for 429
      summary.retriesFor429++;
      
      // Calculate backoff delay (capped to reasonable max)
      const retryAfter = error.response?.headers['retry-after'];
      let backoffMs: number;
      const maxBackoffMs = 8000; // Cap at 8 seconds max
      
      if (retryAfter) {
        // Use Retry-After header if present (in seconds), but cap it
        const headerMs = parseInt(retryAfter, 10) * 1000;
        backoffMs = Math.min(headerMs, maxBackoffMs);
      } else {
        // Exponential backoff: 500ms, 1s, 2s, 4s
        backoffMs = Math.min(500 * Math.pow(2, attempt), maxBackoffMs);
      }
      
      console.log(`  ⏳ 429 on ${context} - retry ${attempt + 1}/${maxRetries} after ${backoffMs}ms...`);
      await sleep(backoffMs);
    }
  }
  
  throw lastError;
}

async function testEndpoint(
  client: AxiosInstance,
  test: EndpointTest,
  userLevel: string,
): Promise<EndpointResult> {
  const { endpoint, method, params, minLevel, description, expectEmpty } = test;

  // Check if user should have access
  const hasAccess = canAccessEndpoint(userLevel, minLevel);

  try {
    // Wrap request with retry logic for 429 errors
    const response = await retryWithBackoff(
      () => client.request({
        method,
        url: endpoint,
        params,
      }),
      `${method} ${endpoint}`,
    );

    const data = response.data;

    // If user shouldn't have access but got 200, that's a problem (unless explicitly empty)
    if (!hasAccess && !expectEmpty) {
      return {
        endpoint,
        description,
        status: 'FAIL',
        statusCode: response.status,
        message: `Expected 403 but got 200 (RBAC not enforcing)`,
      };
    }

    // Determine record count
    let recordCount: number | undefined;
    let isEmpty = false;

    if (Array.isArray(data)) {
      recordCount = data.length;
      isEmpty = recordCount === 0;
    } else if (data && typeof data === 'object') {
      if ('data' in data && Array.isArray(data.data)) {
        recordCount = data.data.length;
        isEmpty = recordCount === 0;
      } else if ('count' in data) {
        recordCount = data.count;
        isEmpty = recordCount === 0;
      } else if ('total' in data) {
        recordCount = data.total;
        isEmpty = recordCount === 0;
      } else if ('orders' in data && typeof data.orders === 'object' && 'total' in data.orders) {
        recordCount = data.orders.total;
        isEmpty = recordCount === 0;
      } else {
        recordCount = Object.keys(data).length;
      }
    }

    // Check if empty when shouldn't be (unless expectEmpty flag set)
    if (isEmpty && !expectEmpty && hasAccess) {
      return {
        endpoint,
        description,
        status: 'FAIL',
        statusCode: response.status,
        recordCount,
        message: 'Empty response - seed data missing or branchId mismatch',
      };
    }

    return {
      endpoint,
      description,
      status: 'PASS',
      statusCode: response.status,
      recordCount,
      message: isEmpty ? 'Empty (expected)' : `${recordCount} records`,
    };

  } catch (error: any) {
    const statusCode = error.response?.status;
    const errorMessage = error.response?.data?.message || error.message;

    // If 403 and user shouldn't have access, that's correct RBAC
    if (statusCode === 403 && !hasAccess) {
      return {
        endpoint,
        description,
        status: 'RBAC_DENIED',
        statusCode,
        message: 'Correctly denied by RBAC',
      };
    }

    // If 403 but user should have access, that's wrong RBAC
    if (statusCode === 403 && hasAccess) {
      return {
        endpoint,
        description,
        status: 'FAIL',
        statusCode,
        message: `RBAC denied but user level ${userLevel} should have access (min: ${minLevel})`,
      };
    }

    // Other errors
    return {
      endpoint,
      description,
      status: 'ERROR',
      statusCode,
      message: `${statusCode || 'NETWORK'}: ${errorMessage}`,
    };
  }
}

async function testRole(
  email: string,
  roleLevel: string,
  role: string,
  org: string,
  isFranchise: boolean,
): Promise<TestResult> {
  console.log(`\n🧪 Testing ${org} - ${role} (${roleLevel}) - ${email}`);

  const result: TestResult = {
    email,
    roleLevel,
    role,
    org,
    loginSuccess: false,
    branchId: null,
    endpointResults: [],
  };

  // Step 1: Login
  console.log(`  🔐 Attempting login for ${email}...`);
  const token = await login(email, DEMO_PASSWORD);
  console.log(`  🔑 Token received: ${token ? 'YES (' + token.substring(0, 20) + '...)' : 'NO'}`);
  
  if (!token) {
    console.error(`  ❌ Login failed - no token received`);
    result.endpointResults.push({
      endpoint: '/auth/login',
      description: 'Login',
      status: 'ERROR',
      message: 'Login failed',
    });
    return result;
  }

  result.loginSuccess = true;
  let client = createClient(token);

  console.log(`  ✅ Login successful, testing /me...`);

  // Step 2: Get /me
  let orgId: string | undefined;
  try {
    const meResponse = await retryWithBackoff(
      () => client.get('/me'),
      'GET /me',
    );
    const userData = meResponse.data;
    result.branchId = userData.branchId;
    orgId = userData.orgId;

    // Recreate client with orgId and branchId headers
    client = createClient(token, orgId, result.branchId ?? undefined);

    // Check branchId requirement (non-L5 users must have branchId)
    if (roleLevel !== 'L5' && !result.branchId) {
      result.branchIdError = 'branchId is NULL (non-L5 user must have branch assigned)';
      console.log(`  ⚠️  ${result.branchIdError}`);
    }

    console.log(`  ✅ /me successful - branchId: ${result.branchId || 'NULL'}, orgId: ${orgId}`);
  } catch (error: any) {
    console.error(`  ❌ /me failed:`, error.response?.data || error.message);
    result.endpointResults.push({
      endpoint: '/me',
      description: 'Get user profile',
      status: 'ERROR',
      message: error.response?.data?.message || error.message,
    });
    return result;
  }

  // Step 3: Test endpoints based on role level
  let endpointsToTest: EndpointTest[] = [...COMMON_ENDPOINTS];

  switch (roleLevel) {
    case 'L1':
      endpointsToTest = [...endpointsToTest, ...L1_ENDPOINTS];
      break;
    case 'L2':
      endpointsToTest = [...endpointsToTest, ...L2_ENDPOINTS];
      break;
    case 'L3':
      endpointsToTest = [...endpointsToTest, ...L3_ENDPOINTS];
      break;
    case 'L4':
      endpointsToTest = [...endpointsToTest, ...L4_ENDPOINTS];
      if (isFranchise) {
        endpointsToTest = [...endpointsToTest, ...FRANCHISE_ENDPOINTS];
      }
      break;
    case 'L5':
      endpointsToTest = [...endpointsToTest, ...L5_ENDPOINTS];
      if (isFranchise) {
        endpointsToTest = [...endpointsToTest, ...FRANCHISE_ENDPOINTS];
      }
      break;
  }

  console.log(`  📝 Testing ${endpointsToTest.length} endpoints for ${roleLevel} role...`);

  // Test each endpoint
  for (const endpointTest of endpointsToTest) {
    const testResult = await testEndpoint(client, endpointTest, roleLevel);
    result.endpointResults.push(testResult);

    summary.totalExecuted++;
    switch (testResult.status) {
      case 'PASS':
        summary.passed++;
        console.log(`  ✅ ${testResult.description}: ${testResult.message}`);
        break;
      case 'FAIL':
        summary.failed++;
        console.log(`  ❌ ${testResult.description}: ${testResult.message}`);
        break;
      case 'RBAC_DENIED':
        summary.rbacDeniedExpected++;
        console.log(`  🔒 ${testResult.description}: ${testResult.message}`);
        break;
      case 'ERROR':
        summary.errors++;
        console.log(`  ⚠️  ${testResult.description}: ${testResult.message}`);
        break;
    }
  }

  return result;
}

// Helper function to format role result for output file
function formatRoleResult(roleResult: TestResult): string {
  const lines = [
    `\n### ${roleResult.org} - ${roleResult.role} (${roleResult.roleLevel})`,
    `Email: ${roleResult.email}`,
    `Login: ${roleResult.loginSuccess ? '✅ SUCCESS' : '❌ FAILED'}`,
    `Branch ID: ${roleResult.branchId || 'NULL'}`,
  ];

  if (roleResult.branchIdError) {
    lines.push(`⚠️  ${roleResult.branchIdError}`);
  }

  lines.push('', 'Endpoint Tests:');
  roleResult.endpointResults.forEach((endpointResult) => {
    const emoji = endpointResult.status === 'PASS' ? '✅' : endpointResult.status === 'FAIL' ? '❌' : endpointResult.status === 'RBAC_DENIED' ? '🔒' : '⚠️';
    lines.push(`  ${emoji} ${endpointResult.endpoint} - ${endpointResult.description}`);
    lines.push(`     Status: ${endpointResult.status}, Message: ${endpointResult.message}`);
    if (endpointResult.recordCount !== undefined) {
      lines.push(`     Records: ${endpointResult.recordCount}`);
    }
  });

  lines.push('');
  return lines.join('\n');
}

async function main() {
  console.log('🚀 ChefCloud V2 - M7.4 Role Coverage Verification');
  console.log(`📍 API Base: ${API_BASE}`);
  console.log(`📅 Date: ${new Date().toISOString()}`);
  console.log(`⚙️  Filters: role=${CLI_ARGS.role}, org=${CLI_ARGS.org}`);

  // Initialize output file
  initOutputFile(CLI_ARGS.out);

  // Build test plan based on CLI arguments
  let rolesToTest: Array<{ email: string; roleLevel: string; role: string; org: 'Tapas' | 'Cafesserie'; isFranchise: boolean }> = [];

  // Filter Tapas roles
  if (CLI_ARGS.org === 'tapas' || CLI_ARGS.org === 'both') {
    const filteredTapas = CLI_ARGS.role === 'all' 
      ? TAPAS_ROLES 
      : TAPAS_ROLES.filter(r => r.role.toLowerCase() === CLI_ARGS.role);
    
    rolesToTest.push(...filteredTapas.map(r => ({ 
      email: r.email, 
      roleLevel: r.roleLevel, 
      role: r.role, 
      org: 'Tapas' as const, 
      isFranchise: false 
    })));
  }

  // Filter Cafesserie roles
  if (CLI_ARGS.org === 'cafesserie' || CLI_ARGS.org === 'both') {
    const filteredCafe = CLI_ARGS.role === 'all'
      ? CAFESSERIE_ROLES
      : CAFESSERIE_ROLES.filter(r => r.role.toLowerCase() === CLI_ARGS.role);
    
    rolesToTest.push(...filteredCafe.map(r => ({ 
      email: r.email, 
      roleLevel: r.roleLevel, 
      role: r.role, 
      org: 'Cafesserie' as const, 
      isFranchise: true 
    })));
  }

  // Calculate planned tests
  let plannedTests = 0;
  rolesToTest.forEach(r => {
    let endpointCount = COMMON_ENDPOINTS.length;
    switch (r.roleLevel) {
      case 'L1': endpointCount += L1_ENDPOINTS.length; break;
      case 'L2': endpointCount += L2_ENDPOINTS.length; break;
      case 'L3': endpointCount += L3_ENDPOINTS.length; break;
      case 'L4': endpointCount += L4_ENDPOINTS.length + (r.isFranchise ? FRANCHISE_ENDPOINTS.length : 0); break;
      case 'L5': endpointCount += L5_ENDPOINTS.length + (r.isFranchise ? FRANCHISE_ENDPOINTS.length : 0); break;
    }
    plannedTests += endpointCount;
  });

  console.log(`📋 Planned Tests: ${rolesToTest.length} roles × avg ${Math.round(plannedTests / rolesToTest.length)} endpoints = ${plannedTests} total tests`);
  appendToOutput(`Test Plan: ${rolesToTest.length} roles, ${plannedTests} planned endpoint tests\n`);

  // HARD FAIL if no tests planned
  if (plannedTests === 0) {
    console.error('❌ HARD FAIL: 0 tests planned. Check --role and --org filters.');
    appendToOutput('❌ HARD FAIL: 0 tests planned. Check --role and --org filters.');
    closeOutputFile();
    process.exit(1);
  }

  // Test all filtered roles
  let currentOrg = '';
  for (const roleConfig of rolesToTest) {
    // Print org header when switching
    if (roleConfig.org !== currentOrg) {
      currentOrg = roleConfig.org;
      const header = roleConfig.org === 'Tapas' 
        ? '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📍 TAPAS BAR & RESTAURANT (Single Branch)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
        : '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n📍 CAFESSERIE (4 Branches - Franchise)\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━';
      console.log(header);
      appendToOutput(header + '\n');
    }

    const result = await testRole(
      roleConfig.email,
      roleConfig.roleLevel,
      roleConfig.role,
      roleConfig.org,
      roleConfig.isFranchise,
    );
    allResults.push(result);

    // Write role result immediately (progressive output)
    const roleOutput = formatRoleResult(result);
    appendToOutput(roleOutput);

    // Delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  // Store planned tests in summary
  summary.totalPlanned = plannedTests;

  // Print summary
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📊 SUMMARY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

  // Calculate reconciliation
  const reconciliationSum = summary.passed + summary.failed + summary.rbacDeniedExpected + summary.errors + summary.skipped;
  const reconciles = reconciliationSum === summary.totalExecuted;

  console.log(`\n📋 Planned Tests: ${summary.totalPlanned}`);
  console.log(`🔢 Executed Tests: ${summary.totalExecuted}`);
  console.log(`✅ Passed: ${summary.passed} (${((summary.passed / summary.totalExecuted) * 100).toFixed(1)}%)`);
  console.log(`❌ Failed: ${summary.failed} (${((summary.failed / summary.totalExecuted) * 100).toFixed(1)}%)`);
  console.log(`🔒 RBAC Denied (Expected): ${summary.rbacDeniedExpected} (${((summary.rbacDeniedExpected / summary.totalExecuted) * 100).toFixed(1)}%)`);
  console.log(`⚠️  Errors: ${summary.errors} (${((summary.errors / summary.totalExecuted) * 100).toFixed(1)}%)`);
  console.log(`⏭️  Skipped: ${summary.skipped}`);
  console.log(`⏳ 429 Retries: ${summary.retriesFor429}`);
  console.log(`\n📊 Reconciliation: ${reconciliationSum} = ${summary.passed} + ${summary.failed} + ${summary.rbacDeniedExpected} + ${summary.errors} + ${summary.skipped} ${reconciles ? '✅' : '❌'}`);

  // Write summary to output file
  const summaryLines = [
    '\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '## FINAL SUMMARY',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    '',
    `📋 Planned Tests: ${summary.totalPlanned}`,
    `🔢 Executed Tests: ${summary.totalExecuted}`,
    `✅ Passed: ${summary.passed} (${((summary.passed / summary.totalExecuted) * 100).toFixed(1)}%)`,
    `❌ Failed: ${summary.failed} (${((summary.failed / summary.totalExecuted) * 100).toFixed(1)}%)`,
    `🔒 RBAC Denied (Expected): ${summary.rbacDeniedExpected} (${((summary.rbacDeniedExpected / summary.totalExecuted) * 100).toFixed(1)}%)`,
    `⚠️  Errors: ${summary.errors} (${((summary.errors / summary.totalExecuted) * 100).toFixed(1)}%)`,
    `⏭️  Skipped: ${summary.skipped}`,
    `⏳ 429 Retries: ${summary.retriesFor429}`,
    '',
    '### Outcome Breakdown',
    '| Category | Count | % |',
    '|----------|-------|---|',
    `| Passed | ${summary.passed} | ${((summary.passed / summary.totalExecuted) * 100).toFixed(1)}% |`,
    `| Failed | ${summary.failed} | ${((summary.failed / summary.totalExecuted) * 100).toFixed(1)}% |`,
    `| RBAC Denied (Expected) | ${summary.rbacDeniedExpected} | ${((summary.rbacDeniedExpected / summary.totalExecuted) * 100).toFixed(1)}% |`,
    `| Errors | ${summary.errors} | ${((summary.errors / summary.totalExecuted) * 100).toFixed(1)}% |`,
    `| Skipped | ${summary.skipped} | ${((summary.skipped / summary.totalExecuted) * 100).toFixed(1)}% |`,
    `| **Total Executed** | **${summary.totalExecuted}** | **100%** |`,
    '',
    `📊 Reconciliation: ${reconciliationSum} = passed + failed + rbacDenied + errors + skipped ${reconciles ? '✅ MATCHES' : '❌ MISMATCH'}`,
    '',
  ];

  // List all failures
  if (summary.failed > 0) {
    summaryLines.push('❌ FAILED TESTS:');
    summaryLines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n❌ FAILED TESTS:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    allResults.forEach((roleResult) => {
      const failures = roleResult.endpointResults.filter((e) => e.status === 'FAIL');
      if (failures.length > 0) {
        const failureHeader = `\n${roleResult.org} - ${roleResult.role} (${roleResult.email}):`;
        console.log(failureHeader);
        summaryLines.push(failureHeader);
        failures.forEach((failure) => {
          const failureLine1 = `  ❌ ${failure.endpoint} - ${failure.description}`;
          const failureLine2 = `     ${failure.message}`;
          console.log(failureLine1);
          console.log(failureLine2);
          summaryLines.push(failureLine1);
          summaryLines.push(failureLine2);
        });
      }
    });
    summaryLines.push('');
  }

  // List branchId issues
  const branchIdIssues = allResults.filter((r) => r.branchIdError);
  if (branchIdIssues.length > 0) {
    summaryLines.push('⚠️  BRANCH ID ISSUES:');
    summaryLines.push('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n⚠️  BRANCH ID ISSUES:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    branchIdIssues.forEach((r) => {
      const issueLine = `  ⚠️  ${r.email}: ${r.branchIdError}`;
      console.log(issueLine);
      summaryLines.push(issueLine);
    });
    summaryLines.push('');
  }

  // Write summary to file and close
  appendToOutput(summaryLines.join('\n'));
  closeOutputFile();
  console.log(`\n📄 Detailed results written to: ${OUTPUT_FILE}`);

  console.log('\n✨ Verification complete!');

  // Exit with error code if any failures
  process.exitCode = (summary.failed > 0 || summary.errors > 0) ? 1 : 0;
}

main().catch((error) => {
  console.error('❌ Script failed:', error);
  if (OUTPUT_STREAM) {
    appendToOutput(`\n❌ SCRIPT FAILED: ${error.message}\n${error.stack}`);
    closeOutputFile();
  }
  process.exit(1);
});
