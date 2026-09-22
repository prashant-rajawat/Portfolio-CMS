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

async function runStep10ExperienceTests() {
  console.log('====================================================');
  console.log('Step 10 Experience & Timeline CMS Test Suite');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL database using pg-mem
  const db = newDb();

  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Execute full DB schema migrations
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

  // 2. Seed Admin and Non-Admin User accounts
  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const adminEmail = 'admin.step10@portfolio.test';
  const userEmail = 'visitor.step10@portfolio.test';
  const password = 'StrongPassword123!';
  const passwordHash = await AuthService.hashPassword(password);

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Lead Architect Admin', adminEmail, passwordHash, 'admin']
  );

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [userId, 'Portfolio Visitor', userEmail, passwordHash, 'user']
  );

  // 3. Start ephemeral Express HTTP test server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Acquire tokens
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminAccessToken = adminLoginData.data?.accessToken;

    const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password }),
    });
    const userLoginData = await userLoginRes.json();
    const userAccessToken = userLoginData.data?.accessToken;

    console.log('--- 1. Experience CMS Initialization & Authentication Tests ---');

    // Test 1: GET /api/experience returns 200 and empty array [] on initial repository
    const emptyExpRes = await fetch(`${baseUrl}/api/experience`);
    const emptyExpData = await emptyExpRes.json();
    recordTest(
      1,
      'GET /api/experience returns 200 and data: [] on unpopulated database',
      emptyExpRes.status === 200 && Array.isArray(emptyExpData.data) && emptyExpData.data.length === 0
    );

    // Test 2: POST /api/experience rejects unauthenticated request (401)
    const unauthExpRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        company: 'Stripe',
        position: 'Infrastructure Engineer',
        description: 'Distributed payments infrastructure.',
        start_date: '2022-01-01',
      }),
    });
    recordTest(2, 'POST /api/experience rejects unauthenticated request with 401', unauthExpRes.status === 401);

    // Test 3: POST /api/experience rejects non-admin visitor token (403)
    const nonAdminExpRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        company: 'Stripe',
        position: 'Infrastructure Engineer',
        description: 'Distributed payments infrastructure.',
        start_date: '2022-01-01',
      }),
    });
    recordTest(3, 'POST /api/experience rejects non-admin user with 403 Forbidden', nonAdminExpRes.status === 403);

    console.log('\n--- 2. Experience Validation Tests ---');

    // Test 4: POST /api/experience rejects empty company (400)
    const missingCompanyRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: '',
        position: 'Senior Engineer',
        description: 'Led architecture',
        start_date: '2021-01-01',
      }),
    });
    recordTest(4, 'POST /api/experience rejects empty company with 400 Bad Request', missingCompanyRes.status === 400);

    // Test 5: POST /api/experience rejects empty position (400)
    const missingPosRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: 'Google',
        position: '',
        description: 'Led architecture',
        start_date: '2021-01-01',
      }),
    });
    recordTest(5, 'POST /api/experience rejects empty position with 400 Bad Request', missingPosRes.status === 400);

    // Test 6: POST /api/experience rejects empty description (400)
    const missingDescRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: 'Google',
        position: 'Staff Engineer',
        description: '',
        start_date: '2021-01-01',
      }),
    });
    recordTest(6, 'POST /api/experience rejects empty description with 400 Bad Request', missingDescRes.status === 400);

    // Test 7: POST /api/experience rejects missing or invalid start_date (400)
    const invalidStartRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: 'Google',
        position: 'Staff Engineer',
        description: 'Led cloud systems team',
        start_date: 'invalid-date-format',
      }),
    });
    recordTest(7, 'POST /api/experience rejects invalid start_date format with 400 Bad Request', invalidStartRes.status === 400);

    // Test 8: POST /api/experience rejects end_date before start_date (400)
    const invalidRangeRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: 'Google',
        position: 'Staff Engineer',
        description: 'Led cloud systems team',
        start_date: '2023-01-01',
        end_date: '2021-01-01', // Before start_date
        is_current: false,
      }),
    });
    recordTest(
      8,
      'POST /api/experience rejects end_date preceding start_date with 400 Bad Request',
      invalidRangeRes.status === 400
    );

    console.log('\n--- 3. Creation & Present Role Tests ---');

    // Test 9: POST /api/experience creates past role with end_date (201)
    const createPastRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: 'Vercel Inc.',
        position: 'Senior Edge Infrastructure Engineer',
        description: 'Architected globally distributed edge routing layer handling 2B+ daily requests.',
        start_date: '2021-03-01',
        end_date: '2023-08-31',
        is_current: false,
        display_order: 1,
      }),
    });
    const createPastData = await createPastRes.json();
    const pastExpId = createPastData.data?.id;
    recordTest(
      9,
      'POST /api/experience creates completed career role with 201 Created',
      createPastRes.status === 201 &&
        createPastData.data?.company === 'Vercel Inc.' &&
        createPastData.data?.is_current === false &&
        !!pastExpId
    );

    // Test 10: POST /api/experience creates current active role with is_current: true (201)
    const createCurrentRes = await fetch(`${baseUrl}/api/experience`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        company: 'DeepMind Platforms',
        position: 'Principal Distributed Systems Architect',
        description: 'Leading multi-region AI inference clusters and low-latency agent execution fabrics.',
        start_date: '2023-09-01',
        is_current: true,
        display_order: 0, // Top priority
      }),
    });
    const createCurrentData = await createCurrentRes.json();
    const currentExpId = createCurrentData.data?.id;
    recordTest(
      10,
      'POST /api/experience creates current role with is_current=true, null end_date, and 201 Created',
      createCurrentRes.status === 201 &&
        createCurrentData.data?.is_current === true &&
        createCurrentData.data?.end_date === null &&
        !!currentExpId
    );

    // Test 11: GET /api/experience returns items in display_order sequence
    const listExpRes = await fetch(`${baseUrl}/api/experience`);
    const listExpData = await listExpRes.json();
    recordTest(
      11,
      'GET /api/experience returns entries ordered by display_order ASC',
      listExpRes.status === 200 &&
        Array.isArray(listExpData.data) &&
        listExpData.data.length === 2 &&
        listExpData.data[0].company === 'DeepMind Platforms' &&
        listExpData.data[1].company === 'Vercel Inc.'
    );

    console.log('\n--- 4. Update & Edge Case Tests ---');

    // Test 12: PUT /api/experience/:id updates experience record (200)
    const updateExpRes = await fetch(`${baseUrl}/api/experience/${pastExpId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        position: 'Staff Edge Infrastructure Engineer',
        display_order: 2,
      }),
    });
    const updateExpData = await updateExpRes.json();
    recordTest(
      12,
      'PUT /api/experience/:id updates record with 200 OK',
      updateExpRes.status === 200 &&
        updateExpData.data?.position === 'Staff Edge Infrastructure Engineer' &&
        updateExpData.data?.display_order === 2
    );

    // Test 13: PUT /api/experience/:id rejects invalid date range (400)
    const updateInvalidRangeRes = await fetch(`${baseUrl}/api/experience/${pastExpId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        start_date: '2024-01-01',
        end_date: '2020-01-01',
        is_current: false,
      }),
    });
    recordTest(
      13,
      'PUT /api/experience/:id rejects invalid chronological range with 400 Bad Request',
      updateInvalidRangeRes.status === 400
    );

    // Test 14: PUT /api/experience/:id with invalid UUID returns 400
    const invalidUuidPutRes = await fetch(`${baseUrl}/api/experience/not-a-valid-uuid`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ company: 'Test' }),
    });
    recordTest(14, 'PUT /api/experience/:id rejects invalid UUID param with 400', invalidUuidPutRes.status === 400);

    // Test 15: PUT /api/experience/:id with non-existent UUID returns 404
    const nonExistentPutRes = await fetch(`${baseUrl}/api/experience/${crypto.randomUUID()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ company: 'NonExistent' }),
    });
    recordTest(15, 'PUT /api/experience/:id returns 404 for non-existent record', nonExistentPutRes.status === 404);

    console.log('\n--- 5. Delete Operation & Safety Tests ---');

    // Test 16: DELETE /api/experience/:id deletes experience with 200 OK
    const deleteRes = await fetch(`${baseUrl}/api/experience/${pastExpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(16, 'DELETE /api/experience/:id deletes entry with 200 OK', deleteRes.status === 200);

    // Test 17: GET /api/experience confirms deleted item is removed
    const verifyDeleteRes = await fetch(`${baseUrl}/api/experience`);
    const verifyDeleteData = await verifyDeleteRes.json();
    recordTest(
      17,
      'GET /api/experience confirms deleted entry is removed from database',
      verifyDeleteRes.status === 200 &&
        Array.isArray(verifyDeleteData.data) &&
        verifyDeleteData.data.length === 1 &&
        verifyDeleteData.data[0].id === currentExpId
    );

    // Test 18: DELETE /api/experience/:id returns 404 for non-existent record
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/experience/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(18, 'DELETE /api/experience/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

    // Test 19: DELETE /api/experience/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/experience/${currentExpId}`, {
      method: 'DELETE',
    });
    recordTest(19, 'DELETE /api/experience/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 20: DELETE /api/experience/:id rejects non-admin token (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/experience/${currentExpId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(20, 'DELETE /api/experience/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 10 Experience Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep10ExperienceTests().catch((err) => {
  console.error('Fatal error during Step 10 Experience tests:', err);
  process.exit(1);
});
