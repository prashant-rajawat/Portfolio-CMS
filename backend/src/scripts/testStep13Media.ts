import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';
import { StorageService, IStorageAdapter, StorageUploadResult } from '../services/storage.service.ts';

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
 * Mock storage adapter for deterministic offline testing.
 */
class MockStorageAdapter implements IStorageAdapter {
  public uploadedFiles = new Map<string, { buffer: Buffer; mimeType: string }>();
  public deletedFiles: string[] = [];
  public shouldFailUpload = false;

  public async upload(storagePath: string, buffer: Buffer, mimeType: string): Promise<StorageUploadResult> {
    if (this.shouldFailUpload) {
      throw new Error('Simulated cloud storage network timeout');
    }
    this.uploadedFiles.set(storagePath, { buffer, mimeType });
    return {
      storagePath,
      storageUrl: `https://mock-supabase.storage.local/portfolio-media/${storagePath}`,
    };
  }

  public async delete(storagePath: string): Promise<void> {
    this.deletedFiles.push(storagePath);
    this.uploadedFiles.delete(storagePath);
  }

  public getPublicUrl(storagePath: string): string {
    return `https://mock-supabase.storage.local/portfolio-media/${storagePath}`;
  }

  public reset(): void {
    this.uploadedFiles.clear();
    this.deletedFiles = [];
    this.shouldFailUpload = false;
  }
}

/**
 * Helper to construct multipart/form-data payloads natively.
 */
function createMultipartPayload(
  fieldName: string,
  fileName: string,
  contentType: string,
  fileContent: Buffer
): { boundary: string; body: Buffer } {
  const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
  const header = `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`;
  const footer = `\r\n--${boundary}--\r\n`;

  const body = Buffer.concat([
    Buffer.from(header, 'utf-8'),
    fileContent,
    Buffer.from(footer, 'utf-8'),
  ]);

  return { boundary, body };
}

// Valid image binary buffers
const VALID_JPEG_BUFFER = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]),
  Buffer.from('Fake JPEG image content for testing media upload pipeline'),
]);

const VALID_PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
  Buffer.from('Fake PNG image content for testing media upload pipeline'),
]);

const VALID_WEBP_BUFFER = Buffer.concat([
  Buffer.from([0x52, 0x49, 0x46, 0x46, 0x30, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50]),
  Buffer.from('Fake WebP image content for testing media upload pipeline'),
]);

async function runStep13MediaTests() {
  console.log('====================================================');
  console.log('Step 13 Media Library Management Test Suite');
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

  // Set mock storage adapter
  const mockStorage = new MockStorageAdapter();
  StorageService.setAdapter(mockStorage);

  // 2. Seed Admin and Non-Admin User accounts
  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const adminEmail = 'admin.step13@portfolio.test';
  const userEmail = 'visitor.step13@portfolio.test';
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

    console.log('--- 1. Media Library Authentication & Empty State Tests ---');

    // Test 1: GET /api/upload rejects unauthenticated request (401)
    const unauthGetRes = await fetch(`${baseUrl}/api/upload`);
    recordTest(1, 'GET /api/upload rejects unauthenticated request with 401', unauthGetRes.status === 401);

    // Test 2: GET /api/upload rejects non-admin visitor token (403)
    const nonAdminGetRes = await fetch(`${baseUrl}/api/upload`, {
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(2, 'GET /api/upload rejects non-admin token with 403 Forbidden', nonAdminGetRes.status === 403);

    // Test 3: GET /api/upload returns 200 and data: [] for admin on empty database
    const adminEmptyGetRes = await fetch(`${baseUrl}/api/upload`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const adminEmptyGetData = await adminEmptyGetRes.json();
    recordTest(
      3,
      'GET /api/upload returns 200 and empty array [] for authenticated admin',
      adminEmptyGetRes.status === 200 &&
        Array.isArray(adminEmptyGetData.data) &&
        adminEmptyGetData.data.length === 0
    );

    console.log('\n--- 2. Media Upload Authentication & Validation Tests ---');

    // Test 4: POST /api/upload/image rejects unauthenticated request (401)
    const { boundary: b1, body: body1 } = createMultipartPayload(
      'file',
      'photo.jpg',
      'image/jpeg',
      VALID_JPEG_BUFFER
    );
    const unauthUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/form-data; boundary=${b1}` },
      body: body1 as any,
    });
    recordTest(4, 'POST /api/upload/image rejects unauthenticated request with 401', unauthUploadRes.status === 401);

    // Test 5: POST /api/upload/image rejects non-admin token (403)
    const nonAdminUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${b1}`,
        Authorization: `Bearer ${userAccessToken}`,
      },
      body: body1 as any,
    });
    recordTest(5, 'POST /api/upload/image rejects non-admin token with 403 Forbidden', nonAdminUploadRes.status === 403);

    // Test 6: POST /api/upload/image rejects request without file (400)
    const emptyFormBoundary = '----WebKitFormBoundaryEmpty';
    const emptyFormBody = Buffer.from(`--${emptyFormBoundary}--\r\n`);
    const noFileUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${emptyFormBoundary}`,
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: emptyFormBody as any,
    });
    recordTest(6, 'POST /api/upload/image rejects request without file with 400', noFileUploadRes.status === 400);

    // Test 7: POST /api/upload/image rejects unsupported file types (e.g. PDF/TXT) (400)
    const { boundary: bPdf, body: bodyPdf } = createMultipartPayload(
      'file',
      'document.pdf',
      'application/pdf',
      Buffer.from('%PDF-1.4 Fake PDF file content')
    );
    const pdfUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bPdf}`,
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: bodyPdf as any,
    });
    recordTest(7, 'POST /api/upload/image rejects non-image PDF file with 400 Bad Request', pdfUploadRes.status === 400);

    // Test 8: POST /api/upload/image rejects file with forged extension (magic bytes mismatch) (400)
    const { boundary: bForged, body: bodyForged } = createMultipartPayload(
      'file',
      'script.png',
      'image/png',
      Buffer.from('malicious_executable_disguised_as_png')
    );
    const forgedUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bForged}`,
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: bodyForged as any,
    });
    recordTest(8, 'POST /api/upload/image rejects magic bytes signature mismatch with 400', forgedUploadRes.status === 400);

    console.log('\n--- 3. Successful Upload & Record Creation Tests ---');

    // Test 9: POST /api/upload/image successfully uploads JPEG image (201)
    const { boundary: bJpeg, body: bodyJpeg } = createMultipartPayload(
      'file',
      'hero-banner.jpg',
      'image/jpeg',
      VALID_JPEG_BUFFER
    );
    const jpegUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bJpeg}`,
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: bodyJpeg as any,
    });
    const jpegUploadData = await jpegUploadRes.json();
    const jpegMedia = jpegUploadData.data;

    recordTest(
      9,
      'POST /api/upload/image successfully uploads JPEG and records in database (201)',
      jpegUploadRes.status === 201 &&
        jpegMedia?.original_filename === 'hero-banner.jpg' &&
        jpegMedia?.mime_type === 'image/jpeg' &&
        jpegMedia?.storage_path.startsWith('images/') &&
        jpegMedia?.storage_url.includes('hero-banner') === false && // Safe random UUID in storage path
        mockStorage.uploadedFiles.has(jpegMedia?.storage_path)
    );

    // Test 10: POST /api/upload/image successfully uploads PNG image (201)
    const { boundary: bPng, body: bodyPng } = createMultipartPayload(
      'file',
      'project-screenshot.png',
      'image/png',
      VALID_PNG_BUFFER
    );
    const pngUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bPng}`,
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: bodyPng as any,
    });
    const pngUploadData = await pngUploadRes.json();
    const pngMedia = pngUploadData.data;

    recordTest(
      10,
      'POST /api/upload/image successfully uploads PNG and records in database (201)',
      pngUploadRes.status === 201 &&
        pngMedia?.original_filename === 'project-screenshot.png' &&
        pngMedia?.mime_type === 'image/png' &&
        mockStorage.uploadedFiles.has(pngMedia?.storage_path)
    );

    // Test 11: POST /api/upload/image successfully uploads WebP image (201)
    const { boundary: bWebp, body: bodyWebp } = createMultipartPayload(
      'file',
      'avatar-icon.webp',
      'image/webp',
      VALID_WEBP_BUFFER
    );
    const webpUploadRes = await fetch(`${baseUrl}/api/upload/image`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${bWebp}`,
        Authorization: `Bearer ${adminAccessToken}`,
      },
      body: bodyWebp as any,
    });
    const webpUploadData = await webpUploadRes.json();
    const webpMedia = webpUploadData.data;

    recordTest(
      11,
      'POST /api/upload/image successfully uploads WebP and records in database (201)',
      webpUploadRes.status === 201 &&
        webpMedia?.original_filename === 'avatar-icon.webp' &&
        webpMedia?.mime_type === 'image/webp' &&
        mockStorage.uploadedFiles.has(webpMedia?.storage_path)
    );

    console.log('\n--- 4. Media List & Metadata Inspection Tests ---');

    // Test 12: GET /api/upload returns all 3 media items ordered by created_at DESC
    const listRes = await fetch(`${baseUrl}/api/upload`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const listData = await listRes.json();
    recordTest(
      12,
      'GET /api/upload returns all uploaded media items in chronological order',
      listRes.status === 200 &&
        Array.isArray(listData.data) &&
        listData.data.length === 3 &&
        listData.data[0].id === webpMedia.id &&
        listData.data[1].id === pngMedia.id &&
        listData.data[2].id === jpegMedia.id
    );

    // Test 13: GET /api/upload/:id returns single media details
    const detailRes = await fetch(`${baseUrl}/api/upload/${jpegMedia.id}`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const detailData = await detailRes.json();
    recordTest(
      13,
      'GET /api/upload/:id returns single media asset details with 200 OK',
      detailRes.status === 200 &&
        detailData.data?.id === jpegMedia.id &&
        detailData.data?.original_filename === 'hero-banner.jpg' &&
        detailData.data?.storage_url === jpegMedia.storage_url
    );

    // Test 14: GET /api/upload/:id returns 404 for non-existent UUID
    const nonExistentUuid = crypto.randomUUID();
    const nonExistentDetailRes = await fetch(`${baseUrl}/api/upload/${nonExistentUuid}`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(14, 'GET /api/upload/:id returns 404 for non-existent UUID', nonExistentDetailRes.status === 404);

    // Test 15: GET /api/upload/:id returns 400 for invalid UUID format
    const invalidUuidDetailRes = await fetch(`${baseUrl}/api/upload/not-a-valid-uuid`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(15, 'GET /api/upload/:id returns 400 for invalid UUID parameter', invalidUuidDetailRes.status === 400);

    console.log('\n--- 5. Media Deletion & Storage Consistency Tests ---');

    // Test 16: DELETE /api/upload/:id rejects unauthenticated request (401)
    const unauthDeleteRes = await fetch(`${baseUrl}/api/upload/${jpegMedia.id}`, {
      method: 'DELETE',
    });
    recordTest(16, 'DELETE /api/upload/:id rejects unauthenticated request with 401', unauthDeleteRes.status === 401);

    // Test 17: DELETE /api/upload/:id rejects non-admin token (403)
    const nonAdminDeleteRes = await fetch(`${baseUrl}/api/upload/${jpegMedia.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${userAccessToken}` },
    });
    recordTest(17, 'DELETE /api/upload/:id rejects non-admin token with 403 Forbidden', nonAdminDeleteRes.status === 403);

    // Test 18: DELETE /api/upload/:id returns 400 for invalid UUID
    const invalidDeleteRes = await fetch(`${baseUrl}/api/upload/not-a-valid-uuid`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(18, 'DELETE /api/upload/:id returns 400 for invalid UUID format', invalidDeleteRes.status === 400);

    // Test 19: DELETE /api/upload/:id returns 404 for non-existent record
    const nonExistentDeleteRes = await fetch(`${baseUrl}/api/upload/${crypto.randomUUID()}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(19, 'DELETE /api/upload/:id returns 404 for non-existent record', nonExistentDeleteRes.status === 404);

    // Test 20: DELETE /api/upload/:id safely deletes storage file and database record (200)
    const deleteJpegRes = await fetch(`${baseUrl}/api/upload/${jpegMedia.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    recordTest(
      20,
      'DELETE /api/upload/:id safely deletes storage file and database record (200 OK)',
      deleteJpegRes.status === 200 &&
        mockStorage.deletedFiles.includes(jpegMedia.storage_path) &&
        !mockStorage.uploadedFiles.has(jpegMedia.storage_path)
    );

    // Test 21: GET /api/upload confirms deleted item is removed from database
    const verifyListRes = await fetch(`${baseUrl}/api/upload`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const verifyListData = await verifyListRes.json();
    recordTest(
      21,
      'GET /api/upload confirms deleted media item is removed from collection',
      verifyListRes.status === 200 &&
        Array.isArray(verifyListData.data) &&
        verifyListData.data.length === 2 &&
        verifyListData.data.every((item: any) => item.id !== jpegMedia.id)
    );

    // Test 22: Delete remaining media items leaving library clean
    const deletePngRes = await fetch(`${baseUrl}/api/upload/${pngMedia.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const deleteWebpRes = await fetch(`${baseUrl}/api/upload/${webpMedia.id}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const finalEmptyRes = await fetch(`${baseUrl}/api/upload`, {
      headers: { Authorization: `Bearer ${adminAccessToken}` },
    });
    const finalEmptyData = await finalEmptyRes.json();

    recordTest(
      22,
      'DELETE /api/upload/:id removes all remaining media items leaving database empty []',
      deletePngRes.status === 200 &&
        deleteWebpRes.status === 200 &&
        finalEmptyRes.status === 200 &&
        Array.isArray(finalEmptyData.data) &&
        finalEmptyData.data.length === 0 &&
        mockStorage.deletedFiles.length === 3
    );

  } finally {
    server.close();
  }

  // Summary
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log('\n====================================================');
  console.log(`Step 13 Media Library Test Summary: Total: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('====================================================');

  if (failed > 0) {
    process.exit(1);
  }
}

runStep13MediaTests().catch((err) => {
  console.error('Fatal error during Step 13 Media Library tests:', err);
  process.exit(1);
});
