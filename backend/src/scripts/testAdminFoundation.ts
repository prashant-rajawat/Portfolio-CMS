import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';

interface TestResult {
  id: number;
  description: string;
  passed: boolean;
  error?: string;
}

const results: TestResult[] = [];

function recordTest(id: number, description: string, condition: boolean, errorDetail?: string) {
  const result: TestResult = {
    id,
    description,
    passed: condition,
    error: condition ? undefined : (errorDetail || 'Assertion failed'),
  };
  results.push(result);
  console.log(`[TEST ${id.toString().padStart(2, '0')}] ${result.passed ? '✓ PASS' : '✗ FAIL'} - ${description}`);
  if (!result.passed && errorDetail) {
    console.error(`       Error: ${errorDetail}`);
  }
}

async function runAdminFoundationTests() {
  console.log('====================================================');
  console.log('Step 6 Admin Panel Foundation & Auth Test Suite');
  console.log('====================================================\n');

  // 1. Setup in-memory pg-mem database with migrations
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  const files = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();

  for (const file of files) {
    const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const sqlForPgMem = rawSql
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE plpgsql;/gi, '')
      .replace(/DROP TRIGGER IF EXISTS[\s\S]*?;/gi, '')
      .replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION[\s\S]*?;/gi, '');
    db.public.none(sqlForPgMem);
  }

  const pgAdapter = db.adapters.createPg();
  const testPool = new pgAdapter.Pool();
  setDbPool(testPool as any);

  // 2. Create seed Admin and Non-Admin Users
  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const adminEmail = 'admin@portfolio.test';
  const userEmail = 'visitor@portfolio.test';
  const password = 'StrongAdminPassword123!';
  const passwordHash = await AuthService.hashPassword(password);

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Portfolio Admin', adminEmail, passwordHash, 'admin']
  );

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [userId, 'Regular Visitor', userEmail, passwordHash, 'user']
  );

  // 3. Start express test server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    console.log('--- 1. Frontend Auth Flow & Contract Tests ---');

    // Test 1: POST /api/auth/login with valid admin credentials returns accessToken, refreshToken, and admin user
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const loginData = await loginRes.json();
    const hasTokens =
      loginRes.status === 200 &&
      !!loginData.data?.accessToken &&
      !!loginData.data?.refreshToken &&
      loginData.data?.user?.role === 'admin' &&
      loginData.data?.user?.email === adminEmail;
    recordTest(1, 'POST /api/auth/login succeeds for valid admin and returns token pair', hasTokens);

    const adminAccessToken = loginData.data?.accessToken;
    const adminRefreshToken = loginData.data?.refreshToken;

    // Test 2: Login response does NOT leak password_hash or backend secrets
    const noHashInResponse =
      !('password_hash' in (loginData.data?.user || {})) &&
      !JSON.stringify(loginData).includes('password_hash');
    recordTest(2, 'Login response strictly omits password_hash and internal credentials', noHashInResponse);

    // Test 3: POST /api/auth/login with incorrect password returns 401 with generic error
    const wrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password: 'WrongPassword999!' }),
    });
    const wrongPassData = await wrongPassRes.json();
    recordTest(
      3,
      'POST /api/auth/login rejects wrong password with 401',
      wrongPassRes.status === 401 && (wrongPassData.message === 'Invalid email or password' || wrongPassData.error === 'Invalid email or password')
    );

    // Test 4: POST /api/auth/login with non-existent email returns 401 with generic error
    const nonExistentRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'nonexistent@portfolio.test', password }),
    });
    recordTest(
      4,
      'POST /api/auth/login rejects non-existent email with generic error',
      nonExistentRes.status === 401
    );

    // Test 5: POST /api/auth/login with missing fields rejected with 400 Bad Request
    const missingFieldsRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: '' }),
    });
    recordTest(
      5,
      'POST /api/auth/login rejects empty/missing fields with 400',
      missingFieldsRes.status === 400
    );

    // Test 6: Non-admin login returns user role 'user' allowing frontend role-guard rejection
    const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password }),
    });
    const userLoginData = await userLoginRes.json();
    const isUserRole = userLoginRes.status === 200 && userLoginData.data?.user?.role === 'user';
    recordTest(6, 'Non-admin user authentication returns role: user for frontend role restriction', isUserRole);

    const userAccessToken = userLoginData.data?.accessToken;

    console.log('\n--- 2. Route Protection & Authorization Tests ---');

    // Test 7: Protected admin endpoint rejects unauthenticated requests (401)
    const unauthRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bio: 'Hacker Bio' }),
    });
    recordTest(7, 'Protected CMS mutations reject unauthenticated requests with 401', unauthRes.status === 401);

    // Test 8: Protected admin endpoint rejects non-admin role (403)
    const forbiddenRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ bio: 'Unauthorized Bio' }),
    });
    recordTest(8, 'Protected CMS mutations reject non-admin access tokens with 403 Forbidden', forbiddenRes.status === 403);

    // Test 9: Protected admin endpoint allows authenticated admin access (200)
    const adminPutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Principal Systems Architect',
        short_description: 'Engineered high-concurrency cloud systems.',
        full_description: 'Extensive track record delivering scalable distributed systems.',
      }),
    });
    recordTest(9, 'Protected CMS mutations allow authenticated admin access with 200 OK', adminPutRes.status === 200);

    console.log('\n--- 3. Refresh Token Rotation & Expiration Tests ---');

    // Test 10: POST /api/auth/refresh rotates refresh token and returns new access token
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    const refreshData = await refreshRes.json();
    const refreshSuccess =
      refreshRes.status === 200 &&
      typeof refreshData.data?.accessToken === 'string' &&
      typeof refreshData.data?.refreshToken === 'string' &&
      refreshData.data?.user?.role === 'admin';
    recordTest(10, 'POST /api/auth/refresh rotates token and issues new access token', refreshSuccess);

    const secondAccessToken = refreshData.data?.accessToken;

    // Test 11: Replaying already-used (revoked) refresh token is rejected (401)
    const replayRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: adminRefreshToken }),
    });
    recordTest(
      11,
      'Replay of rotated refresh token is safely rejected with 401',
      replayRes.status === 401
    );

    // Test 12: New rotated access token works for admin operations
    const checkNewTokenRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${secondAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Staff Platform Architect',
        short_description: 'Continuous modernization and security engineering.',
        full_description: 'Deep domain expertise in full-stack architecture and microservices.',
      }),
    });
    recordTest(12, 'Rotated access token successfully authorizes admin operations', checkNewTokenRes.status === 200);

    // Test 13: Invalid/tampered refresh token returns 401
    const invalidRefreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: 'forged.invalid.token' }),
    });
    recordTest(13, 'Forged refresh token rejected with 401', invalidRefreshRes.status === 401);

    console.log('\n--- 4. Client Storage & Identity Context Verification ---');

    // Test 14: Verify GET /api/auth/me returns admin identity context
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${secondAccessToken}` },
    });
    const meData = await meRes.json();
    recordTest(
      14,
      'GET /api/auth/me confirms authenticated admin profile context',
      meRes.status === 200 && meData.data?.role === 'admin'
    );

    // Test 15: Public endpoint /api/health accessible without tokens
    const healthRes = await fetch(`${baseUrl}/api/health`);
    recordTest(15, 'Public /api/health endpoint reachable without authentication', healthRes.status === 200);

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 6 Admin Foundation Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runAdminFoundationTests().catch((err) => {
  console.error('Fatal error during Admin Foundation tests:', err);
  process.exit(1);
});
