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

async function runStep12ServicesTests() {
  console.log('====================================================');
  console.log('Step 12 Services CMS Test Suite');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL database using pg-mem
  const db = newDb();

  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Execute migrations
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
  const adminEmail = 'admin.step12@portfolio.test';
  const userEmail = 'visitor.step12@portfolio.test';
  const password = 'StrongPassword123!';
  const passwordHash = await AuthService.hashPassword(password);

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Principal Architect Admin', adminEmail, passwordHash, 'admin']
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

    console.log('--- 1. Services CMS Initialization & Authentication Tests ---');

    // Test 1: GET /api/services returns 200 and empty array [] on initial repository
    const emptyServicesRes = await fetch(`${baseUrl}/api/services`);
    const emptyServicesData = await emptyServicesRes.json();
    recordTest(
      1,
      'GET /api/services returns 200 and data: [] on unpopulated database',
      emptyServicesRes.status === 200 && Array.isArray(emptyServicesData.data) && emptyServicesData.data.length === 0
    );

    // Test 2: POST /api/services rejects unauthenticated request (401)
    const unauthServicesRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Web Development',
        description: 'Building responsive and scalable modern web applications.',
      }),
    });
    recordTest(2, 'POST /api/services rejects unauthenticated request with 401', unauthServicesRes.status === 401);

    // Test 3: POST /api/services rejects non-admin visitor token (403)
    const nonAdminServicesRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Web Development',
        description: 'Building responsive and scalable modern web applications.',
      }),
    });
    recordTest(3, 'POST /api/services rejects non-admin user with 403 Forbidden', nonAdminServicesRes.status === 403);

    console.log('\n--- 2. Services Validation Tests ---');

    // Test 4: POST /api/services rejects empty title (400)
    const missingTitleRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: '',
        description: 'Building responsive and scalable modern web applications.',
      }),
    });
    recordTest(4, 'POST /api/services rejects empty title with 400 Bad Request', missingTitleRes.status === 400);

    // Test 5: POST /api/services rejects title exceeding 255 characters (400)
    const longTitleRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'A'.repeat(256),
        description: 'Building responsive and scalable modern web applications.',
      }),
    });
    recordTest(5, 'POST /api/services rejects title exceeding 255 chars with 400 Bad Request', longTitleRes.status === 400);

    // Test 6: POST /api/services rejects empty description (400)
    const missingDescriptionRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Web Development',
        description: '',
      }),
    });
    recordTest(6, 'POST /api/services rejects empty description with 400 Bad Request', missingDescriptionRes.status === 400);

    // Test 7: POST /api/services creates service without optional icon_url
    const createMinimalRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Cloud Solutions & DevOps',
        description: 'Automating deployment pipelines and orchestrating microservices.',
        display_order: 1,
      }),
    });
    const createMinimalData = await createMinimalRes.json();
    const minimalServiceId = createMinimalData.data?.id;
    recordTest(
      7,
      'POST /api/services creates service without optional icon_url (201)',
      createMinimalRes.status === 201 &&
        createMinimalData.data?.title === 'Cloud Solutions & DevOps' &&
        createMinimalData.data?.icon_url === null &&
        createMinimalData.data?.display_order === 1 &&
        !!minimalServiceId
    );

    console.log('\n--- 3. Creation & Ordering Tests ---');

    // Test 8: POST /api/services creates full service with icon_url
    const createFullRes = await fetch(`${baseUrl}/api/services`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Web Development',
        description: 'Building responsive and scalable modern web applications.',
        icon_url: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c',
        display_order: 0, // Top priority
      }),
    });
    const createFullData = await createFullRes.json();
    const fullServiceId = createFullData.data?.id;
    recordTest(
      8,
      'POST /api/services creates full service with icon_url (201)',
      createFullRes.status === 201 &&
        createFullData.data?.title === 'Web Development' &&
        createFullData.data?.icon_url === 'https://images.unsplash.com/photo-1555066931-4365d14bab8c' &&
        createFullData.data?.display_order === 0 &&
        !!fullServiceId
    );

    // Test 9: GET /api/services returns items ordered by display_order ASC
    const listRes = await fetch(`${baseUrl}/api/services`);
    const listData = await listRes.json();
    recordTest(
      9,
      'GET /api/services returns services ordered by display_order ASC',
      listRes.status === 200 &&
        Array.isArray(listData.data) &&
        listData.data.length === 2 &&
        listData.data[0].title === 'Web Development' &&
        listData.data[1].title === 'Cloud Solutions & DevOps'
    );

    console.log('\n--- 4. Update & Validation Tests ---');

    // Test 10: PUT /api/services/:id updates service in-place (200)
    const updateRes = await fetch(`${baseUrl}/api/services/${fullServiceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Full-Stack Web Engineering',
        display_order: 3,
      }),
    });
    const updateData = await updateRes.json();
    recordTest(
      10,
      'PUT /api/services/:id updates record with 200 OK',
      updateRes.status === 200 &&
        updateData.data?.title === 'Full-Stack Web Engineering' &&
        updateData.data?.display_order === 3 &&
        updateData.data?.description === 'Building responsive and scalable modern web applications.' // preserved
    );

    // Test 11: PUT /api/services/:id with invalid UUID returns 400
    const invalidUuidPutRes = await fetch(`${baseUrl}/api/services/not-a-valid-uuid`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ title: 'Test' }),
    });
    recordTest(11, 'PUT /api/services/:id rejects invalid UUID param with 400', invalidUuidPutRes.status === 400);

    // Test 12: PUT /api/services/:id with non-existent UUID returns 404
    const nonExistentPutRes = await fetch(`${baseUrl}/api/services/${crypto.randomUUID()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ title: 'NonExistent' }),
    });
    recordTest(12, 'PUT /api/services/:id returns 404 for non-existent record', nonExistentPutRes.status === 404);

    // Test 13: PUT /api/services rejects unauthenticated request (401)
    const unauthPutRes = await fetch(`${baseUrl}/api/services/${fullServiceId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Hacked' }),
    });
    recordTest(13, 'PUT /api/services/:id rejects unauthenticated request with 401', unauthPutRes.status === 401);

    // Test 14: PUT /api/services rejects non-admin token (403)
    const nonAdminPutRes = await fetch(`${baseUrl}/api/services/${fullServiceId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ title: 'Hacked' }),
    });
    recordTest(14, 'PUT /api/services/:id rejects non-admin token with 403 Forbidden', nonAdminPutRes.status === 403);

    console.log('\n--- 5. Delete Operation & Safety Tests ---');

    // Test 15: DELETE /api/services/:id deletes service with 200 OK
    const deleteRes = await fetch(`${baseUrl}/api/services/${minimalServiceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(15, 'DELETE /api/services/:id deletes entry with 200 OK', deleteRes.status === 200);

    // Test 16: GET /api/services confirms deleted item is removed
    const verifyDeleteRes = await fetch(`${baseUrl}/api/services`);
    const verifyDeleteData = await verifyDeleteRes.json();
    recordTest(
      16,
      'GET /api/services confirms deleted entry is removed from database',
      verifyDeleteRes.status === 200 &&
        Array.isArray(verifyDeleteData.data) &&
        verifyDeleteData.data.length === 1 &&
        verifyDeleteData.data[0].id === fullServiceId
    );

    // Test 17: DELETE /api/services/:id returns 404 for non-existent record
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/services/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(17, 'DELETE /api/services/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

    // Test 18: DELETE /api/services/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/services/${fullServiceId}`, {
      method: 'DELETE',
    });
    recordTest(18, 'DELETE /api/services/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 19: DELETE /api/services/:id rejects non-admin token (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/services/${fullServiceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(19, 'DELETE /api/services/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

    // Test 20: DELETE /api/services/:id deletes remaining record leaving database clean
    const finalDeleteRes = await fetch(`${baseUrl}/api/services/${fullServiceId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const finalGetRes = await fetch(`${baseUrl}/api/services`);
    const finalGetData = await finalGetRes.json();
    recordTest(
      20,
      'DELETE /api/services removes final item and resets state to empty array []',
      finalDeleteRes.status === 200 &&
        finalGetRes.status === 200 &&
        Array.isArray(finalGetData.data) &&
        finalGetData.data.length === 0
    );

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 12 Services Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep12ServicesTests().catch((err) => {
  console.error('Fatal error during Step 12 Services tests:', err);
  process.exit(1);
});
