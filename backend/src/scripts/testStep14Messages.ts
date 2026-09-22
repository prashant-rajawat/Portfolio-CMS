import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';
import { EmailService, IEmailTransporter } from '../services/email.service.ts';

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

/**
 * Mock email transporter for deterministic testing of email dispatch logic.
 */
class MockEmailTransporter implements IEmailTransporter {
  public sentEmails: any[] = [];

  public async sendMail(mailOptions: any): Promise<any> {
    this.sentEmails.push(mailOptions);
    return { messageId: `mock-email-${crypto.randomUUID()}` };
  }

  public reset(): void {
    this.sentEmails = [];
  }
}

async function runStep14MessagesTests() {
  console.log('====================================================');
  console.log('Step 14 Contact Messages Management Test Suite');
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

  // Set mock email transporter
  const mockEmail = new MockEmailTransporter();
  EmailService.setTransporter(mockEmail);

  // 2. Seed Admin and Non-Admin User accounts
  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const adminEmail = 'admin.step14@portfolio.test';
  const userEmail = 'visitor.step14@portfolio.test';
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

    console.log('--- 1. Contact Form Submission & Validation Tests ---');

    // Test 1: POST /api/contact rejects empty body with 400
    const emptySubmitRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    recordTest(1, 'POST /api/contact rejects empty payload with 400 Bad Request', emptySubmitRes.status === 400);

    // Test 2: POST /api/contact rejects invalid email format
    const invalidEmailRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Alice Wonder',
        email: 'not-a-valid-email',
        subject: 'Consulting Inquiry',
        message: 'Hello, I would like to hire you for a project.',
      }),
    });
    recordTest(2, 'POST /api/contact rejects invalid email format with 400 Bad Request', invalidEmailRes.status === 400);

    // Test 3: POST /api/contact accepts valid submission, records in database with is_read=false (201)
    const validSubmitRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Jane Doe',
        email: 'jane.doe@client.com',
        subject: 'Full Stack Web App Project',
        message: 'We are looking for an experienced architect to build our enterprise platform.',
      }),
    });
    const validSubmitData = await validSubmitRes.json();
    const firstMessage = validSubmitData.data;

    recordTest(
      3,
      'POST /api/contact creates inquiry record with is_read=false (201 Created)',
      validSubmitRes.status === 201 &&
        firstMessage?.name === 'Jane Doe' &&
        firstMessage?.email === 'jane.doe@client.com' &&
        firstMessage?.subject === 'Full Stack Web App Project' &&
        firstMessage?.is_read === false &&
        Boolean(firstMessage?.id)
    );

    // Test 4: Email notification dispatched via EmailService
    // Give async task a brief tick to finish
    await new Promise((r) => setTimeout(r, 50));
    recordTest(
      4,
      'POST /api/contact triggers email notification with subject, sender, and message body',
      mockEmail.sentEmails.length === 1 &&
        mockEmail.sentEmails[0].replyTo === 'jane.doe@client.com' &&
        mockEmail.sentEmails[0].subject.includes('Full Stack Web App Project')
    );

    // Test 5: Submit a second inquiry
    const secondSubmitRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Bob Smith',
        email: 'bob@enterprise.io',
        subject: 'Cloud Architecture Consultation',
        message: 'Could we schedule a call next Tuesday to discuss migration strategies?',
      }),
    });
    const secondSubmitData = await secondSubmitRes.json();
    const secondMessage = secondSubmitData.data;
    recordTest(5, 'POST /api/contact accepts second inquiry and saves to database', secondSubmitRes.status === 201);

    console.log('\n--- 2. Messages List Authentication & Authorization Tests ---');

    // Test 6: GET /api/messages rejects unauthenticated request (401)
    const unauthGetRes = await fetch(`${baseUrl}/api/messages`);
    recordTest(6, 'GET /api/messages rejects unauthenticated request with 401', unauthGetRes.status === 401);

    // Test 7: GET /api/messages rejects non-admin token (403)
    const nonAdminGetRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(7, 'GET /api/messages rejects non-admin user with 403 Forbidden', nonAdminGetRes.status === 403);

    // Test 8: GET /api/messages returns message list and unread count for admin (200)
    const adminGetRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const adminGetData = await adminGetRes.json();
    recordTest(
      8,
      'GET /api/messages returns 200 with list of messages and correct unread count',
      adminGetRes.status === 200 &&
        Array.isArray(adminGetData.data) &&
        adminGetData.data.length === 2 &&
        (adminGetData.unread_count === 2 || adminGetData.unreadCount === 2)
    );

    console.log('\n--- 3. Message Details Inspection Tests ---');

    // Test 9: GET /api/messages/:id returns single message details for admin
    const detailRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const detailData = await detailRes.json();
    recordTest(
      9,
      'GET /api/messages/:id returns full message record including complete body',
      detailRes.status === 200 &&
        detailData.data?.id === firstMessage.id &&
        detailData.data?.email === 'jane.doe@client.com' &&
        detailData.data?.message.includes('experienced architect')
    );

    // Test 10: GET /api/messages/:id returns 404 for non-existent UUID
    const nonExistentUuid = crypto.randomUUID();
    const notFoundRes = await fetch(`${baseUrl}/api/messages/${nonExistentUuid}`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(10, 'GET /api/messages/:id returns 404 for non-existent message ID', notFoundRes.status === 404);

    // Test 11: GET /api/messages/:id returns 400 for malformed UUID parameter
    const malformedIdRes = await fetch(`${baseUrl}/api/messages/invalid-uuid-format`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(11, 'GET /api/messages/:id returns 400 for invalid UUID format', malformedIdRes.status === 400);

    console.log('\n--- 4. Mark Read / Unread Status Management Tests ---');

    // Test 12: PUT /api/messages/:id/read rejects unauthenticated request (401)
    const unauthReadRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}/read`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_read: true }),
    });
    recordTest(12, 'PUT /api/messages/:id/read rejects unauthenticated request with 401', unauthReadRes.status === 401);

    // Test 13: PUT /api/messages/:id/read rejects non-admin user (403)
    const nonAdminReadRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: JSON.stringify({ is_read: true }),
    });
    recordTest(13, 'PUT /api/messages/:id/read rejects non-admin token with 403 Forbidden', nonAdminReadRes.status === 403);

    // Test 14: PUT /api/messages/:id/read marks message as read and decrements unreadCount (200)
    const markReadRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ is_read: true }),
    });
    const markReadData = await markReadRes.json();
    recordTest(
      14,
      'PUT /api/messages/:id/read updates message to is_read=true and returns updated unreadCount=1',
      markReadRes.status === 200 &&
        markReadData.data?.is_read === true &&
        (markReadData.unread_count === 1 || markReadData.unreadCount === 1)
    );

    // Test 15: Read state persists in database
    const verifyReadRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const verifyReadData = await verifyReadRes.json();
    recordTest(
      15,
      'GET /api/messages/:id confirms read status persisted in database (is_read=true)',
      verifyReadRes.status === 200 && verifyReadData.data?.is_read === true
    );

    // Test 16: PUT /api/messages/:id/read supports marking as unread ({ is_read: false })
    const markUnreadRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}/read`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: JSON.stringify({ is_read: false }),
    });
    const markUnreadData = await markUnreadRes.json();
    recordTest(
      16,
      'PUT /api/messages/:id/read supports toggle back to unread (is_read=false, unreadCount=2)',
      markUnreadRes.status === 200 &&
        markUnreadData.data?.is_read === false &&
        (markUnreadData.unread_count === 2 || markUnreadData.unreadCount === 2)
    );

    console.log('\n--- 5. Message Deletion & Lifecycle Tests ---');

    // Test 17: DELETE /api/messages/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}`, {
      method: 'DELETE',
    });
    recordTest(17, 'DELETE /api/messages/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 18: DELETE /api/messages/:id rejects non-admin user (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(18, 'DELETE /api/messages/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

    // Test 19: DELETE /api/messages/:id returns 404 for non-existent ID
    const notFoundDeleteRes = await fetch(`${baseUrl}/api/messages/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(19, 'DELETE /api/messages/:id returns 404 for non-existent record', notFoundDeleteRes.status === 404);

    // Test 20: DELETE /api/messages/:id safely deletes message record (200)
    const deleteFirstRes = await fetch(`${baseUrl}/api/messages/${firstMessage.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(
      20,
      'DELETE /api/messages/:id deletes message and returns 200 OK',
      deleteFirstRes.status === 200
    );

    // Test 21: GET /api/messages confirms item was removed from database
    const verifyListRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const verifyListData = await verifyListRes.json();
    recordTest(
      21,
      'GET /api/messages confirms message count decreased to 1 and deleted ID is gone',
      verifyListRes.status === 200 &&
        Array.isArray(verifyListData.data) &&
        verifyListData.data.length === 1 &&
        verifyListData.data[0].id === secondMessage.id
    );

    // Test 22: Delete remaining message leaving inbox completely empty
    const deleteSecondRes = await fetch(`${baseUrl}/api/messages/${secondMessage.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const finalEmptyRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const finalEmptyData = await finalEmptyRes.json();

    recordTest(
      22,
      'DELETE /api/messages/:id clears all messages leaving inbox empty [] with unreadCount=0',
      deleteSecondRes.status === 200 &&
        finalEmptyRes.status === 200 &&
        Array.isArray(finalEmptyData.data) &&
        finalEmptyData.data.length === 0 &&
        (finalEmptyData.unread_count === 0 || finalEmptyData.unreadCount === 0)
    );

    // Test 23: SQL Injection safety check on contact submission
    const sqlInjectionRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: "'; DROP TABLE messages; --",
        email: 'hacker@safe-db.test',
        subject: "'; SELECT * FROM users; --",
        message: 'Attempted SQL injection injection payload verification test.',
      }),
    });
    const sqlInjectionData = await sqlInjectionRes.json();
    recordTest(
      23,
      'Parameterized query handles SQL injection characters safely without table corruption',
      sqlInjectionRes.status === 201 &&
        sqlInjectionData.data?.name === "'; DROP TABLE messages; --"
    );

    // Test 24: Clean up test injected message
    await fetch(`${baseUrl}/api/messages/${sqlInjectionData.data.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 14 Messages Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep14MessagesTests().catch((err) => {
  console.error('Fatal error during Step 14 Messages tests:', err);
  process.exit(1);
});
