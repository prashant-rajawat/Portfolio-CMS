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

async function runStep11TestimonialsTests() {
  console.log('====================================================');
  console.log('Step 11 Testimonials CMS Test Suite');
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
  const adminEmail = 'admin.step11@portfolio.test';
  const userEmail = 'visitor.step11@portfolio.test';
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

    console.log('--- 1. Testimonials CMS Initialization & Authentication Tests ---');

    // Test 1: GET /api/testimonials returns 200 and empty array [] on initial repository
    const emptyTestimonialsRes = await fetch(`${baseUrl}/api/testimonials`);
    const emptyTestimonialsData = await emptyTestimonialsRes.json();
    recordTest(
      1,
      'GET /api/testimonials returns 200 and data: [] on unpopulated database',
      emptyTestimonialsRes.status === 200 && Array.isArray(emptyTestimonialsData.data) && emptyTestimonialsData.data.length === 0
    );

    // Test 2: POST /api/testimonials rejects unauthenticated request (401)
    const unauthTestimonialsRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Rahul Sharma',
        role: 'Founder & CEO',
        company: 'ABC Technologies',
        content: 'Exceptional engineer and leader.',
      }),
    });
    recordTest(2, 'POST /api/testimonials rejects unauthenticated request with 401', unauthTestimonialsRes.status === 401);

    // Test 3: POST /api/testimonials rejects non-admin visitor token (403)
    const nonAdminTestimonialsRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Rahul Sharma',
        role: 'Founder & CEO',
        company: 'ABC Technologies',
        content: 'Exceptional engineer and leader.',
      }),
    });
    recordTest(3, 'POST /api/testimonials rejects non-admin user with 403 Forbidden', nonAdminTestimonialsRes.status === 403);

    console.log('\n--- 2. Testimonials Validation Tests ---');

    // Test 4: POST /api/testimonials rejects empty name (400)
    const missingNameRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: '',
        role: 'VP of Engineering',
        company: 'TechCorp',
        content: 'Brilliant problem solver.',
      }),
    });
    recordTest(4, 'POST /api/testimonials rejects empty name with 400 Bad Request', missingNameRes.status === 400);

    // Test 5: POST /api/testimonials rejects empty role (400)
    const missingRoleRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Sarah Connor',
        role: '',
        company: 'Cyberdyne',
        content: 'Unstoppable execution speed.',
      }),
    });
    recordTest(5, 'POST /api/testimonials rejects empty role with 400 Bad Request', missingRoleRes.status === 400);

    // Test 6: POST /api/testimonials rejects empty content (400)
    const missingContentRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Sarah Connor',
        role: 'Director of Security',
        company: 'Cyberdyne',
        content: '',
      }),
    });
    recordTest(6, 'POST /api/testimonials rejects empty content with 400 Bad Request', missingContentRes.status === 400);

    // Test 7: POST /api/testimonials accepts optional company and null profile_image_url
    const createMinimalRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Alex Rivera',
        role: 'Principal Architect',
        content: 'A true master of high-throughput distributed systems.',
      }),
    });
    const createMinimalData = await createMinimalRes.json();
    const minimalTestimonialId = createMinimalData.data?.id;
    recordTest(
      7,
      'POST /api/testimonials creates testimonial without optional company and profile image (201)',
      createMinimalRes.status === 201 &&
        createMinimalData.data?.name === 'Alex Rivera' &&
        createMinimalData.data?.company === null &&
        createMinimalData.data?.profile_image_url === null &&
        !!minimalTestimonialId
    );

    console.log('\n--- 3. Creation & Ordering Tests ---');

    // Test 8: POST /api/testimonials creates full testimonial with avatar and company
    const createFullRes = await fetch(`${baseUrl}/api/testimonials`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        name: 'Rahul Sharma',
        role: 'Founder & CEO',
        company: 'ABC Technologies',
        content: 'Delivered our core distributed ledger pipeline ahead of schedule with 99.999% uptime.',
        profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb',
        display_order: 0, // Prioritized first
      }),
    });
    const createFullData = await createFullRes.json();
    const fullTestimonialId = createFullData.data?.id;
    recordTest(
      8,
      'POST /api/testimonials creates full testimonial with image and company (201)',
      createFullRes.status === 201 &&
        createFullData.data?.name === 'Rahul Sharma' &&
        createFullData.data?.company === 'ABC Technologies' &&
        createFullData.data?.profile_image_url === 'https://images.unsplash.com/photo-1534528741775-53994a69daeb' &&
        !!fullTestimonialId
    );

    // Test 9: GET /api/testimonials returns items ordered by display_order ASC
    const listRes = await fetch(`${baseUrl}/api/testimonials`);
    const listData = await listRes.json();
    recordTest(
      9,
      'GET /api/testimonials returns entries ordered by display_order ASC',
      listRes.status === 200 &&
        Array.isArray(listData.data) &&
        listData.data.length === 2 &&
        listData.data[0].name === 'Rahul Sharma' &&
        listData.data[1].name === 'Alex Rivera'
    );

    console.log('\n--- 4. Update & Validation Tests ---');

    // Test 10: PUT /api/testimonials/:id updates testimonial in-place (200)
    const updateRes = await fetch(`${baseUrl}/api/testimonials/${fullTestimonialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        role: 'Group CEO & Chairman',
        display_order: 5,
      }),
    });
    const updateData = await updateRes.json();
    recordTest(
      10,
      'PUT /api/testimonials/:id updates record with 200 OK',
      updateRes.status === 200 &&
        updateData.data?.role === 'Group CEO & Chairman' &&
        updateData.data?.display_order === 5 &&
        updateData.data?.name === 'Rahul Sharma' // preserved
    );

    // Test 11: PUT /api/testimonials/:id with invalid UUID returns 400
    const invalidUuidPutRes = await fetch(`${baseUrl}/api/testimonials/not-a-valid-uuid`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ name: 'Test' }),
    });
    recordTest(11, 'PUT /api/testimonials/:id rejects invalid UUID param with 400', invalidUuidPutRes.status === 400);

    // Test 12: PUT /api/testimonials/:id with non-existent UUID returns 404
    const nonExistentPutRes = await fetch(`${baseUrl}/api/testimonials/${crypto.randomUUID()}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ name: 'NonExistent' }),
    });
    recordTest(12, 'PUT /api/testimonials/:id returns 404 for non-existent record', nonExistentPutRes.status === 404);

    // Test 13: PUT /api/testimonials rejects unauthenticated request (401)
    const unauthPutRes = await fetch(`${baseUrl}/api/testimonials/${fullTestimonialId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    recordTest(13, 'PUT /api/testimonials/:id rejects unauthenticated request with 401', unauthPutRes.status === 401);

    // Test 14: PUT /api/testimonials rejects non-admin token (403)
    const nonAdminPutRes = await fetch(`${baseUrl}/api/testimonials/${fullTestimonialId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ name: 'Hacked' }),
    });
    recordTest(14, 'PUT /api/testimonials/:id rejects non-admin token with 403 Forbidden', nonAdminPutRes.status === 403);

    console.log('\n--- 5. Delete Operation & Safety Tests ---');

    // Test 15: DELETE /api/testimonials/:id deletes testimonial with 200 OK
    const deleteRes = await fetch(`${baseUrl}/api/testimonials/${minimalTestimonialId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(15, 'DELETE /api/testimonials/:id deletes entry with 200 OK', deleteRes.status === 200);

    // Test 16: GET /api/testimonials confirms deleted item is removed
    const verifyDeleteRes = await fetch(`${baseUrl}/api/testimonials`);
    const verifyDeleteData = await verifyDeleteRes.json();
    recordTest(
      16,
      'GET /api/testimonials confirms deleted entry is removed from database',
      verifyDeleteRes.status === 200 &&
        Array.isArray(verifyDeleteData.data) &&
        verifyDeleteData.data.length === 1 &&
        verifyDeleteData.data[0].id === fullTestimonialId
    );

    // Test 17: DELETE /api/testimonials/:id returns 404 for non-existent record
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/testimonials/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(17, 'DELETE /api/testimonials/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

    // Test 18: DELETE /api/testimonials/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/testimonials/${fullTestimonialId}`, {
      method: 'DELETE',
    });
    recordTest(18, 'DELETE /api/testimonials/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 19: DELETE /api/testimonials/:id rejects non-admin token (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/testimonials/${fullTestimonialId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(19, 'DELETE /api/testimonials/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

    // Test 20: DELETE /api/testimonials/:id deletes remaining record leaving database clean
    const finalDeleteRes = await fetch(`${baseUrl}/api/testimonials/${fullTestimonialId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const finalGetRes = await fetch(`${baseUrl}/api/testimonials`);
    const finalGetData = await finalGetRes.json();
    recordTest(
      20,
      'DELETE /api/testimonials removes final item and resets state to empty array []',
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
  console.log(`Step 11 Testimonials Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep11TestimonialsTests().catch((err) => {
  console.error('Fatal error during Step 11 Testimonials tests:', err);
  process.exit(1);
});
