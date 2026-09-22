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

async function runStep8ProjectsTests() {
  console.log('====================================================');
  console.log('Step 8 Projects CMS Management Test Suite');
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
  const adminEmail = 'admin.step8@portfolio.test';
  const userEmail = 'visitor.step8@portfolio.test';
  const password = 'StrongPassword123!';
  const passwordHash = await AuthService.hashPassword(password);

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Portfolio Admin', adminEmail, passwordHash, 'admin']
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

    console.log('--- 1. Projects CMS Initialization & Authentication Tests ---');

    // Test 1: GET /api/projects returns 200 and empty array [] on initial repository
    const emptyProjectsRes = await fetch(`${baseUrl}/api/projects`);
    const emptyProjectsData = await emptyProjectsRes.json();
    recordTest(
      1,
      'GET /api/projects returns 200 and data: [] on unpopulated database',
      emptyProjectsRes.status === 200 && Array.isArray(emptyProjectsData.data) && emptyProjectsData.data.length === 0
    );

    // Test 2: POST /api/projects rejects unauthenticated request (401)
    const unauthProjectRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Project',
        slug: 'unauth-proj',
        short_description: 'Short desc',
        full_description: 'Full desc',
      }),
    });
    recordTest(2, 'POST /api/projects rejects unauthenticated request with 401', unauthProjectRes.status === 401);

    // Test 3: POST /api/projects rejects non-admin visitor token (403)
    const nonAdminProjectRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Visitor Project',
        slug: 'visitor-proj',
        short_description: 'Short desc',
        full_description: 'Full desc',
      }),
    });
    recordTest(3, 'POST /api/projects rejects non-admin user with 403 Forbidden', nonAdminProjectRes.status === 403);

    console.log('\n--- 2. Project Validation Tests ---');

    // Test 4: POST /api/projects rejects empty/missing title (400)
    const missingTitleRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: '',
        slug: 'missing-title-slug',
        short_description: 'Short description',
        full_description: 'Full description',
      }),
    });
    recordTest(4, 'POST /api/projects rejects empty title with 400 Bad Request', missingTitleRes.status === 400);

    // Test 5: POST /api/projects rejects missing slug (400)
    const missingSlugRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: '',
        short_description: 'Short description',
        full_description: 'Full description',
      }),
    });
    recordTest(5, 'POST /api/projects rejects empty slug with 400 Bad Request', missingSlugRes.status === 400);

    // Test 6: POST /api/projects rejects invalid slug formatting (spaces or uppercase) (400)
    const invalidSlugRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: 'Invalid Slug With Spaces!',
        short_description: 'Short description',
        full_description: 'Full description',
      }),
    });
    recordTest(
      6,
      'POST /api/projects rejects invalid slug characters with 400 Bad Request',
      invalidSlugRes.status === 400
    );

    // Test 7: POST /api/projects rejects missing short_description (400)
    const missingShortDescRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: 'valid-slug',
        short_description: '',
        full_description: 'Full description',
      }),
    });
    recordTest(7, 'POST /api/projects rejects empty short_description with 400 Bad Request', missingShortDescRes.status === 400);

    // Test 8: POST /api/projects rejects missing full_description (400)
    const missingFullDescRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: 'valid-slug-2',
        short_description: 'Short description',
        full_description: '',
      }),
    });
    recordTest(8, 'POST /api/projects rejects empty full_description with 400 Bad Request', missingFullDescRes.status === 400);

    console.log('\n--- 3. Project Creation & Array Contract Tests ---');

    // Test 9: POST /api/projects creates valid project with string[] technologies array (201)
    const createProject1Res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Cloud Vault Architecture',
        slug: 'cloud-vault',
        short_description: 'Encrypted object storage platform.',
        full_description: 'Architected high-throughput object store handling PB-scale multi-region assets.',
        image_url: 'https://images.unsplash.com/photo-1544197150-b99a580bb7a8',
        technologies: ['TypeScript', 'Node.js', 'PostgreSQL', 'Docker', 'AWS S3'],
        live_url: 'https://cloudvault.app',
        github_url: 'https://github.com/developer/cloud-vault',
        display_order: 1,
      }),
    });
    const createProject1Data = await createProject1Res.json();
    const project1Id = createProject1Data.data?.id;
    recordTest(
      9,
      'POST /api/projects creates project with string[] technologies and returns 201 Created',
      createProject1Res.status === 201 &&
        createProject1Data.data?.title === 'Cloud Vault Architecture' &&
        createProject1Data.data?.slug === 'cloud-vault' &&
        Array.isArray(createProject1Data.data?.technologies) &&
        createProject1Data.data?.technologies.length === 5 &&
        !!project1Id
    );

    // Test 10: POST /api/projects creates second project
    const createProject2Res = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Real-Time Streaming Engine',
        slug: 'streaming-engine',
        short_description: 'Distributed WebSocket event pipeline.',
        full_description: 'Low-latency telemetry streaming engine handling 100k events/sec with backpressure.',
        image_url: 'https://images.unsplash.com/photo-1558494949-ef010cbdcc31',
        technologies: ['Go', 'Redis', 'Kafka', 'React'],
        live_url: 'https://stream.engine.io',
        github_url: 'https://github.com/developer/streaming-engine',
        display_order: 2,
      }),
    });
    const createProject2Data = await createProject2Res.json();
    const project2Id = createProject2Data.data?.id;
    recordTest(
      10,
      'POST /api/projects creates second project with 201 Created',
      createProject2Res.status === 201 && !!project2Id
    );

    // Test 11: GET /api/projects returns list containing created projects in display order
    const listProjectsRes = await fetch(`${baseUrl}/api/projects`);
    const listProjectsData = await listProjectsRes.json();
    recordTest(
      11,
      'GET /api/projects returns all created projects in display order',
      listProjectsRes.status === 200 &&
        Array.isArray(listProjectsData.data) &&
        listProjectsData.data.length === 2 &&
        listProjectsData.data[0].slug === 'cloud-vault' &&
        listProjectsData.data[1].slug === 'streaming-engine'
    );

    console.log('\n--- 4. Slug Collision & Update Tests ---');

    // Test 12: POST /api/projects rejects duplicate slug with 409 Conflict
    const dupSlugRes = await fetch(`${baseUrl}/api/projects`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Another Cloud Vault',
        slug: 'cloud-vault', // Already taken by project 1
        short_description: 'Duplicate slug test',
        full_description: 'This should fail with 409 Conflict.',
        technologies: ['React'],
        display_order: 3,
      }),
    });
    const dupSlugData = await dupSlugRes.json();
    recordTest(
      12,
      'POST /api/projects rejects duplicate slug with 409 Conflict',
      dupSlugRes.status === 409 && (dupSlugData.message?.includes('already exists') || dupSlugData.error?.includes('already exists'))
    );

    // Test 13: PUT /api/projects/:id updates existing project in-place (200)
    const updateProjectRes = await fetch(`${baseUrl}/api/projects/${project1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Cloud Vault Enterprise Suite',
        short_description: 'Enterprise encrypted storage cloud platform.',
        display_order: 0, // Promoted to first
      }),
    });
    const updateProjectData = await updateProjectRes.json();
    recordTest(
      13,
      'PUT /api/projects/:id updates project in-place with 200 OK',
      updateProjectRes.status === 200 &&
        updateProjectData.data?.title === 'Cloud Vault Enterprise Suite' &&
        updateProjectData.data?.display_order === 0
    );

    // Test 14: PUT /api/projects/:id rejects conflict when updating slug to an existing other project's slug (409)
    const updateConflictRes = await fetch(`${baseUrl}/api/projects/${project1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        slug: 'streaming-engine', // Already used by project 2
      }),
    });
    recordTest(
      14,
      'PUT /api/projects/:id rejects collision when changing slug to another project with 409 Conflict',
      updateConflictRes.status === 409
    );

    // Test 15: PUT /api/projects/:id with invalid UUID param returns 400
    const invalidUuidPutRes = await fetch(`${baseUrl}/api/projects/not-a-valid-uuid`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ title: 'Test' }),
    });
    recordTest(15, 'PUT /api/projects/:id rejects invalid UUID param with 400', invalidUuidPutRes.status === 400);

    console.log('\n--- 5. Delete Operation & Safety Tests ---');

    // Test 16: DELETE /api/projects/:id deletes project with 200 OK
    const deleteRes = await fetch(`${baseUrl}/api/projects/${project2Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(16, 'DELETE /api/projects/:id deletes project with 200 OK', deleteRes.status === 200);

    // Test 17: GET /api/projects confirms deleted project is no longer returned
    const verifyDeleteRes = await fetch(`${baseUrl}/api/projects`);
    const verifyDeleteData = await verifyDeleteRes.json();
    recordTest(
      17,
      'GET /api/projects confirms deleted project is removed from collection',
      verifyDeleteRes.status === 200 &&
        Array.isArray(verifyDeleteData.data) &&
        verifyDeleteData.data.length === 1 &&
        verifyDeleteData.data[0].id === project1Id
    );

    // Test 18: DELETE /api/projects/:id returns 404 for non-existent record
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/projects/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(18, 'DELETE /api/projects/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

    // Test 19: DELETE /api/projects/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/projects/${project1Id}`, {
      method: 'DELETE',
    });
    recordTest(19, 'DELETE /api/projects/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 20: DELETE /api/projects/:id rejects non-admin token (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/projects/${project1Id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(20, 'DELETE /api/projects/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 8 Projects Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep8ProjectsTests().catch((err) => {
  console.error('Fatal error during Step 8 Projects tests:', err);
  process.exit(1);
});
