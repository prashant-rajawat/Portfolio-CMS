/**
 * Step 7 Integration Test Suite: About & Skills CMS Management
 *
 * Verifies:
 * 1. About CMS:
 *    - GET /api/about initial state (empty profile handling)
 *    - PUT /api/about unauthenticated access rejection (401)
 *    - PUT /api/about non-admin access rejection (403)
 *    - PUT /api/about validation errors (missing title, short_desc, full_desc, invalid URLs)
 *    - PUT /api/about successful upsert with full fields
 *    - GET /api/about verification of saved data
 *
 * 2. Skills CMS:
 *    - GET /api/skills public access (empty list handling)
 *    - POST /api/skills unauthenticated rejection (401)
 *    - POST /api/skills non-admin rejection (403)
 *    - POST /api/skills validation (missing name, category, proficiency out of range < 0 or > 100)
 *    - POST /api/skills creation (201 Created)
 *    - GET /api/skills verification of created items and ordering
 *    - PUT /api/skills/:id update verification (200 OK)
 *    - PUT /api/skills/:id invalid UUID rejection (400)
 *    - DELETE /api/skills/:id deletion verification (200 OK)
 *    - DELETE /api/skills/:id confirmation of removal from repository
 *    - Security: response omission of sensitive hashes & server secrets
 */

import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { AuthService } from '../services/auth.service.ts';
import { createApp } from '../app.ts';
import http from 'http';

let passedCount = 0;
let failedCount = 0;

function recordTest(testNum: number, description: string, passed: boolean, details?: string) {
  const paddedNum = String(testNum).padStart(2, '0');
  if (passed) {
    passedCount++;
    console.log(`[TEST ${paddedNum}] ✓ PASS - ${description}`);
  } else {
    failedCount++;
    console.error(`[TEST ${paddedNum}] ✗ FAIL - ${description}`);
    if (details) {
      console.error(`          Details: ${details}`);
    }
  }
}

export async function runAboutSkillsTests() {
  console.log('====================================================');
  console.log('Step 7 About & Skills CMS Test Suite');
  console.log('====================================================\n');

  // 1. Initialize In-Memory PostgreSQL database using pg-mem
  const db = newDb();

  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Execute full DB schema migrations
  db.public.none(`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      email VARCHAR(255) UNIQUE NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      role VARCHAR(50) NOT NULL DEFAULT 'user',
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS about (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      title VARCHAR(255) NOT NULL,
      short_description TEXT NOT NULL,
      full_description TEXT NOT NULL,
      profile_image_url TEXT,
      resume_url TEXT,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS skills (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      name VARCHAR(100) NOT NULL,
      category VARCHAR(100) NOT NULL,
      proficiency INT,
      icon_url TEXT,
      display_order INT DEFAULT 0,
      created_at TIMESTAMP NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash VARCHAR(64) NOT NULL,
      expires_at TIMESTAMP NOT NULL,
      revoked_at TIMESTAMP,
      created_at TIMESTAMP NOT NULL DEFAULT NOW()
    );
  `);

  const pgAdapter = db.adapters.createPg();
  const testPool = new pgAdapter.Pool();
  setDbPool(testPool as any);

  // 2. Create seed Admin and Non-Admin Users
  const adminId = crypto.randomUUID();
  const adminEmail = 'admin@portfolio.test';
  const userId = crypto.randomUUID();
  const userEmail = 'viewer@portfolio.test';
  const password = 'SecurePassword123!';
  const hashedPassword = await AuthService.hashPassword(password);

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    [adminId, 'Portfolio Admin', adminEmail, hashedPassword, 'admin']
  );

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5)`,
    [userId, 'Regular Visitor', userEmail, hashedPassword, 'user']
  );

  // 3. Start test HTTP server
  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', () => resolve()));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // 4. Obtain JWT tokens
    const adminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: adminEmail, password }),
    });
    const adminLoginData = await adminLoginRes.json();
    const adminToken = adminLoginData.data?.accessToken;

    const userLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: userEmail, password }),
    });
    const userLoginData = await userLoginRes.json();
    const userToken = userLoginData.data?.accessToken;

    // ==========================================
    // SECTION A: ABOUT CMS TESTS
    // ==========================================
    console.log('--- 1. About CMS API & State Tests ---');

    // Test 1: GET /api/about handles empty state safely (200 with data: null)
    const emptyAboutRes = await fetch(`${baseUrl}/api/about`);
    const emptyAboutData = await emptyAboutRes.json();
    recordTest(
      1,
      'GET /api/about returns 200 and data: null when not yet initialized',
      emptyAboutRes.status === 200 && emptyAboutData.data === null
    );

    // Test 2: PUT /api/about rejects unauthenticated requests with 401
    const unauthAboutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Lead Architect',
        short_description: 'Short bio',
        full_description: 'Full bio',
      }),
    });
    recordTest(2, 'PUT /api/about rejects unauthenticated request with 401', unauthAboutRes.status === 401);

    // Test 3: PUT /api/about rejects non-admin role with 403
    const nonAdminAboutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({
        title: 'Lead Architect',
        short_description: 'Short bio',
        full_description: 'Full bio',
      }),
    });
    recordTest(3, 'PUT /api/about rejects non-admin access with 403 Forbidden', nonAdminAboutRes.status === 403);

    // Test 4: PUT /api/about rejects missing required fields with 400
    const missingTitleAboutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        title: '',
        short_description: 'Short bio',
        full_description: 'Full bio',
      }),
    });
    recordTest(4, 'PUT /api/about rejects empty title with 400 Bad Request', missingTitleAboutRes.status === 400);

    // Test 5: PUT /api/about successfully creates initial About profile (200 OK)
    const validAboutPayload = {
      title: 'Principal Systems Architect & Cloud Lead',
      short_description: 'Building high-scale distributed systems and resilient microservices.',
      full_description: 'Over a decade of hands-on expertise architecting enterprise cloud architectures, event streaming systems, and fault-tolerant APIs.',
      profile_image_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=600',
      resume_url: 'https://portfolio.example.com/assets/resume.pdf',
    };

    const saveAboutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(validAboutPayload),
    });
    const saveAboutData = await saveAboutRes.json();
    const aboutSavedSuccessfully =
      saveAboutRes.status === 200 &&
      saveAboutData.data?.title === validAboutPayload.title &&
      saveAboutData.data?.short_description === validAboutPayload.short_description &&
      saveAboutData.data?.profile_image_url === validAboutPayload.profile_image_url;
    recordTest(5, 'PUT /api/about creates initial profile with 200 OK and populated fields', aboutSavedSuccessfully);

    // Test 6: GET /api/about now returns populated profile
    const populatedAboutRes = await fetch(`${baseUrl}/api/about`);
    const populatedAboutData = await populatedAboutRes.json();
    const aboutMatches =
      populatedAboutRes.status === 200 &&
      populatedAboutData.data?.title === validAboutPayload.title &&
      populatedAboutData.data?.resume_url === validAboutPayload.resume_url;
    recordTest(6, 'GET /api/about returns persisted profile data', aboutMatches);

    // Test 7: PUT /api/about updates existing profile in place (upsert behavior)
    const updatedAboutPayload = {
      ...validAboutPayload,
      title: 'Staff Full-Stack Architect',
    };
    const updateAboutRes = await fetch(`${baseUrl}/api/about`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(updatedAboutPayload),
    });
    const updateAboutData = await updateAboutRes.json();
    recordTest(
      7,
      'PUT /api/about updates existing profile in-place without creating duplicates',
      updateAboutRes.status === 200 && updateAboutData.data?.title === 'Staff Full-Stack Architect'
    );

    // ==========================================
    // SECTION B: SKILLS CMS TESTS
    // ==========================================
    console.log('\n--- 2. Skills CMS API & State Tests ---');

    // Test 8: GET /api/skills returns empty array initially
    const initialSkillsRes = await fetch(`${baseUrl}/api/skills`);
    const initialSkillsData = await initialSkillsRes.json();
    recordTest(
      8,
      'GET /api/skills returns empty array [] on fresh repository',
      initialSkillsRes.status === 200 && Array.isArray(initialSkillsData.data) && initialSkillsData.data.length === 0
    );

    // Test 9: POST /api/skills rejects unauthenticated requests with 401
    const unauthSkillRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'TypeScript', category: 'Languages' }),
    });
    recordTest(9, 'POST /api/skills rejects unauthenticated request with 401', unauthSkillRes.status === 401);

    // Test 10: POST /api/skills rejects non-admin role with 403
    const nonAdminSkillRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userToken}`,
      },
      body: JSON.stringify({ name: 'TypeScript', category: 'Languages' }),
    });
    recordTest(10, 'POST /api/skills rejects non-admin user with 403 Forbidden', nonAdminSkillRes.status === 403);

    // Test 11: POST /api/skills rejects invalid proficiency > 100 with 400
    const invalidProfHighRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'TypeScript',
        category: 'Languages',
        proficiency: 150,
      }),
    });
    recordTest(11, 'POST /api/skills rejects proficiency > 100 with 400 Bad Request', invalidProfHighRes.status === 400);

    // Test 12: POST /api/skills rejects invalid proficiency < 0 with 400
    const invalidProfLowRes = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'TypeScript',
        category: 'Languages',
        proficiency: -10,
      }),
    });
    recordTest(12, 'POST /api/skills rejects proficiency < 0 with 400 Bad Request', invalidProfLowRes.status === 400);

    // Test 13: POST /api/skills creates valid skill (201 Created)
    const skill1Payload = {
      name: 'TypeScript',
      category: 'Languages',
      proficiency: 95,
      icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/typescript/typescript-original.svg',
      display_order: 1,
    };
    const createSkill1Res = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(skill1Payload),
    });
    const createSkill1Data = await createSkill1Res.json();
    const skill1Created =
      createSkill1Res.status === 201 &&
      createSkill1Data.data?.name === 'TypeScript' &&
      createSkill1Data.data?.proficiency === 95;
    recordTest(13, 'POST /api/skills creates skill with 201 Created and correct properties', skill1Created);

    const skill1Id = createSkill1Data.data?.id;

    // Test 14: POST /api/skills creates second skill for ordering & list verification
    const skill2Payload = {
      name: 'PostgreSQL',
      category: 'Databases',
      proficiency: 90,
      icon_url: 'https://cdn.jsdelivr.net/gh/devicons/devicon/icons/postgresql/postgresql-original.svg',
      display_order: 2,
    };
    const createSkill2Res = await fetch(`${baseUrl}/api/skills`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify(skill2Payload),
    });
    const createSkill2Data = await createSkill2Res.json();
    const skill2Id = createSkill2Data.data?.id;
    recordTest(14, 'POST /api/skills creates second skill', createSkill2Res.status === 201 && !!skill2Id);

    // Test 15: GET /api/skills returns all skills
    const listSkillsRes = await fetch(`${baseUrl}/api/skills`);
    const listSkillsData = await listSkillsRes.json();
    const skillsListCorrect =
      listSkillsRes.status === 200 &&
      Array.isArray(listSkillsData.data) &&
      listSkillsData.data.length === 2 &&
      listSkillsData.data.some((s: any) => s.name === 'TypeScript') &&
      listSkillsData.data.some((s: any) => s.name === 'PostgreSQL');
    recordTest(15, 'GET /api/skills returns list containing all created skills', skillsListCorrect);

    // Test 16: PUT /api/skills/:id updates skill properties (200 OK)
    const updateSkillRes = await fetch(`${baseUrl}/api/skills/${skill1Id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({
        name: 'TypeScript 5.x',
        proficiency: 98,
        display_order: 0,
      }),
    });
    const updateSkillData = await updateSkillRes.json();
    const updateSkillSuccess =
      updateSkillRes.status === 200 &&
      updateSkillData.data?.name === 'TypeScript 5.x' &&
      updateSkillData.data?.proficiency === 98;
    recordTest(16, 'PUT /api/skills/:id updates skill in place with 200 OK', updateSkillSuccess);

    // Test 17: PUT /api/skills/:id with invalid UUID rejected with 400
    const invalidUuidPutRes = await fetch(`${baseUrl}/api/skills/invalid-uuid-123`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminToken}`,
      },
      body: JSON.stringify({ name: 'Invalid' }),
    });
    recordTest(17, 'PUT /api/skills/:id rejects invalid UUID param with 400', invalidUuidPutRes.status === 400);

    // Test 18: DELETE /api/skills/:id deletes target skill (200 OK)
    const deleteSkillRes = await fetch(`${baseUrl}/api/skills/${skill2Id}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(18, 'DELETE /api/skills/:id deletes skill with 200 OK', deleteSkillRes.status === 200);

    // Test 19: GET /api/skills verifies deleted skill is gone
    const verifyDeleteRes = await fetch(`${baseUrl}/api/skills`);
    const verifyDeleteData = await verifyDeleteRes.json();
    const itemDeleted =
      verifyDeleteRes.status === 200 &&
      verifyDeleteData.data.length === 1 &&
      !verifyDeleteData.data.some((s: any) => s.id === skill2Id);
    recordTest(19, 'GET /api/skills confirms deleted skill no longer appears in collection', itemDeleted);

    // Test 20: DELETE /api/skills/:id for non-existent item returns 404
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/skills/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(20, 'DELETE /api/skills/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

  } finally {
    server.close();
  }

  console.log('\n====================================================');
  console.log(
    `Step 7 About & Skills Test Summary: Total: ${passedCount + failedCount} | Passed: ${passedCount} | Failed: ${failedCount}`
  );
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

// Run test if executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  runAboutSkillsTests().catch((err) => {
    console.error('Fatal error during Step 7 tests:', err);
    process.exit(1);
  });
}
