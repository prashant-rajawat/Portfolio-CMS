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

async function runStep9BlogsTests() {
  console.log('====================================================');
  console.log('Step 9 Blog Posts CMS Management Test Suite');
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
  const adminEmail = 'admin.step9@portfolio.test';
  const userEmail = 'visitor.step9@portfolio.test';
  const password = 'StrongPassword123!';
  const passwordHash = await AuthService.hashPassword(password);

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Staff Architect Admin', adminEmail, passwordHash, 'admin']
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

    console.log('--- 1. Blog CMS Initialization & Authentication Tests ---');

    // Test 1: GET /api/blogs returns 200 and empty array [] on initial repository
    const emptyBlogsRes = await fetch(`${baseUrl}/api/blogs`);
    const emptyBlogsData = await emptyBlogsRes.json();
    recordTest(
      1,
      'GET /api/blogs returns 200 and data: [] on unpopulated database',
      emptyBlogsRes.status === 200 && Array.isArray(emptyBlogsData.data) && emptyBlogsData.data.length === 0
    );

    // Test 2: POST /api/blogs rejects unauthenticated request (401)
    const unauthBlogRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Unauthenticated Blog',
        slug: 'unauth-blog',
        excerpt: 'Short excerpt',
        content: 'Blog content',
      }),
    });
    recordTest(2, 'POST /api/blogs rejects unauthenticated request with 401', unauthBlogRes.status === 401);

    // Test 3: POST /api/blogs rejects non-admin visitor token (403)
    const nonAdminBlogRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Visitor Blog',
        slug: 'visitor-blog',
        excerpt: 'Short excerpt',
        content: 'Blog content',
      }),
    });
    recordTest(3, 'POST /api/blogs rejects non-admin user with 403 Forbidden', nonAdminBlogRes.status === 403);

    console.log('\n--- 2. Blog Validation Tests ---');

    // Test 4: POST /api/blogs rejects empty title (400)
    const missingTitleRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: '',
        slug: 'missing-title-slug',
        excerpt: 'Excerpt text',
        content: 'Content text',
      }),
    });
    recordTest(4, 'POST /api/blogs rejects empty title with 400 Bad Request', missingTitleRes.status === 400);

    // Test 5: POST /api/blogs rejects empty slug (400)
    const missingSlugRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: '',
        excerpt: 'Excerpt text',
        content: 'Content text',
      }),
    });
    recordTest(5, 'POST /api/blogs rejects empty slug with 400 Bad Request', missingSlugRes.status === 400);

    // Test 6: POST /api/blogs rejects invalid slug characters (400)
    const invalidSlugRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: 'Invalid Slug With Spaces!',
        excerpt: 'Excerpt text',
        content: 'Content text',
      }),
    });
    recordTest(6, 'POST /api/blogs rejects invalid slug characters with 400 Bad Request', invalidSlugRes.status === 400);

    // Test 7: POST /api/blogs rejects missing excerpt (400)
    const missingExcerptRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: 'valid-slug',
        excerpt: '',
        content: 'Content text',
      }),
    });
    recordTest(7, 'POST /api/blogs rejects empty excerpt with 400 Bad Request', missingExcerptRes.status === 400);

    // Test 8: POST /api/blogs rejects missing content (400)
    const missingContentRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Valid Title',
        slug: 'valid-slug-2',
        excerpt: 'Valid excerpt',
        content: '',
      }),
    });
    recordTest(8, 'POST /api/blogs rejects empty content with 400 Bad Request', missingContentRes.status === 400);

    console.log('\n--- 3. Blog Creation, Author Security & Publishing Tests ---');

    // Test 9: POST /api/blogs creates draft blog post and enforces author security
    const fakeAuthorId = crypto.randomUUID();
    const createDraftRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Designing Resilient Distributed Systems',
        slug: 'resilient-distributed-systems',
        excerpt: 'Key strategies for fault-tolerance in microservice architectures.',
        content: 'When designing distributed systems, partitioning tolerance and eventual consistency...',
        featured_image_url: 'https://images.unsplash.com/photo-1518770660439-4636190af475',
        author_id: fakeAuthorId, // Should be ignored and replaced by authenticated admin
        published: false,
      }),
    });
    const createDraftData = await createDraftRes.json();
    const draftId = createDraftData.data?.id;
    recordTest(
      9,
      'POST /api/blogs creates draft post and binds author to authenticated admin ID',
      createDraftRes.status === 201 &&
        createDraftData.data?.published === false &&
        createDraftData.data?.author_id === adminId &&
        createDraftData.data?.published_at === null &&
        !!draftId
    );

    // Test 10: POST /api/blogs creates published blog and automatically assigns published_at
    const createPubRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Zero-Downtime PostgreSQL Schema Migrations',
        slug: 'zero-downtime-postgres-migrations',
        excerpt: 'Safe schema changes without locking tables in high-concurrency environments.',
        content: 'PostgreSQL table locks can cause cascading outages if migrations are not structured with care...',
        featured_image_url: 'https://images.unsplash.com/photo-1544383835-bda2bc66a55d',
        published: true,
      }),
    });
    const createPubData = await createPubRes.json();
    const pubId = createPubData.data?.id;
    recordTest(
      10,
      'POST /api/blogs creates published post and automatically populates published_at timestamp',
      createPubRes.status === 201 &&
        createPubData.data?.published === true &&
        !!createPubData.data?.published_at &&
        !!pubId
    );

    // Test 11: GET /api/blogs returns list with author_name joined from users table
    const listBlogsRes = await fetch(`${baseUrl}/api/blogs`);
    const listBlogsData = await listBlogsRes.json();
    recordTest(
      11,
      'GET /api/blogs returns list with author_name joined from users table',
      listBlogsRes.status === 200 &&
        Array.isArray(listBlogsData.data) &&
        listBlogsData.data.length === 2 &&
        listBlogsData.data[0].author_name === 'Staff Architect Admin'
    );

    console.log('\n--- 4. Slug Collision & Update Tests ---');

    // Test 12: POST /api/blogs rejects duplicate slug with 409 Conflict
    const dupSlugRes = await fetch(`${baseUrl}/api/blogs`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Another Article on Migrations',
        slug: 'zero-downtime-postgres-migrations', // Already taken by post 2
        excerpt: 'Duplicate slug test',
        content: 'This will be rejected.',
      }),
    });
    const dupSlugData = await dupSlugRes.json();
    recordTest(
      12,
      'POST /api/blogs rejects duplicate slug with 409 Conflict',
      dupSlugRes.status === 409 && (dupSlugData.message?.includes('already exists') || dupSlugData.error?.includes('already exists'))
    );

    // Test 13: PUT /api/blogs/:id updates blog and toggles published state
    const updateBlogRes = await fetch(`${baseUrl}/api/blogs/${draftId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        title: 'Designing Resilient Distributed Systems v2',
        published: true, // Promoted from draft to published
      }),
    });
    const updateBlogData = await updateBlogRes.json();
    recordTest(
      13,
      'PUT /api/blogs/:id updates blog in-place and assigns published_at on publish toggle',
      updateBlogRes.status === 200 &&
        updateBlogData.data?.title === 'Designing Resilient Distributed Systems v2' &&
        updateBlogData.data?.published === true &&
        !!updateBlogData.data?.published_at
    );

    // Test 14: PUT /api/blogs/:id rejects collision when updating slug to an existing other blog's slug (409)
    const updateConflictRes = await fetch(`${baseUrl}/api/blogs/${draftId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({
        slug: 'zero-downtime-postgres-migrations', // Already used by pub post
      }),
    });
    recordTest(
      14,
      'PUT /api/blogs/:id rejects collision when changing slug to another blog with 409 Conflict',
      updateConflictRes.status === 409
    );

    // Test 15: PUT /api/blogs/:id with invalid UUID param returns 400
    const invalidUuidPutRes = await fetch(`${baseUrl}/api/blogs/not-a-valid-uuid`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ title: 'Test' }),
    });
    recordTest(15, 'PUT /api/blogs/:id rejects invalid UUID param with 400', invalidUuidPutRes.status === 400);

    console.log('\n--- 5. Delete Operation & Safety Tests ---');

    // Test 16: DELETE /api/blogs/:id deletes blog post with 200 OK
    const deleteRes = await fetch(`${baseUrl}/api/blogs/${pubId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(16, 'DELETE /api/blogs/:id deletes blog with 200 OK', deleteRes.status === 200);

    // Test 17: GET /api/blogs confirms deleted post is no longer returned
    const verifyDeleteRes = await fetch(`${baseUrl}/api/blogs`);
    const verifyDeleteData = await verifyDeleteRes.json();
    recordTest(
      17,
      'GET /api/blogs confirms deleted post is removed from collection',
      verifyDeleteRes.status === 200 &&
        Array.isArray(verifyDeleteData.data) &&
        verifyDeleteData.data.length === 1 &&
        verifyDeleteData.data[0].id === draftId
    );

    // Test 18: DELETE /api/blogs/:id returns 404 for non-existent record
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/blogs/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(18, 'DELETE /api/blogs/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

    // Test 19: DELETE /api/blogs/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/blogs/${draftId}`, {
      method: 'DELETE',
    });
    recordTest(19, 'DELETE /api/blogs/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 20: DELETE /api/blogs/:id rejects non-admin token (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/blogs/${draftId}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(20, 'DELETE /api/blogs/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 9 Blogs Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep9BlogsTests().catch((err) => {
  console.error('Fatal error during Step 9 Blogs tests:', err);
  process.exit(1);
});
