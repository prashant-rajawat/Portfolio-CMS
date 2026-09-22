import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';
import { StorageService, IStorageAdapter, StorageUploadResult } from '../services/storage.service.ts';
import { UploadService } from '../services/upload.service.ts';
import {
  validateUploadedImage,
  validateMagicBytes,
  ALLOWED_MIME_TYPES,
  ALLOWED_EXTENSIONS,
  MAX_FILE_SIZE_BYTES,
} from '../validators/upload.validator.ts';

interface TestSummary {
  id: number;
  description: string;
  passed: boolean;
  detail?: string;
}

const testResults: TestSummary[] = [];

function recordTest(id: number, description: string, passed: boolean, detail?: string) {
  testResults.push({ id, description, passed, detail });
  const status = passed ? '✓ PASS' : '✗ FAIL';
  console.log(`[TEST ${id.toString().padStart(2, '0')}] ${status} - ${description}`);
  if (detail && !passed) {
    console.log(`         Detail: ${detail}`);
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
  fileContent: Buffer,
  additionalFields: Record<string, string> = {}
): { body: Buffer; boundary: string; contentType: string } {
  const boundary = `----WebKitFormBoundary${crypto.randomBytes(16).toString('hex')}`;
  const parts: Buffer[] = [];

  for (const [key, value] of Object.entries(additionalFields)) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${key}"\r\n\r\n${value}\r\n`
      )
    );
  }

  if (fieldName && fileName) {
    parts.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${fieldName}"; filename="${fileName}"\r\nContent-Type: ${contentType}\r\n\r\n`
      )
    );
    parts.push(fileContent);
    parts.push(Buffer.from('\r\n'));
  }

  parts.push(Buffer.from(`--${boundary}--\r\n`));

  const body = Buffer.concat(parts);
  return {
    body,
    boundary,
    contentType: `multipart/form-data; boundary=${boundary}`,
  };
}

/**
 * Generate test image buffers with authentic magic bytes
 */
function createTestJpeg(): Buffer {
  // JPEG starts with FF D8 FF E0
  const header = Buffer.from([
    0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
  ]);
  const payload = Buffer.alloc(100, 0x20);
  return Buffer.concat([header, payload]);
}

function createTestPng(): Buffer {
  // PNG starts with 89 50 4E 47 0D 0A 1A 0A
  const header = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  ]);
  const payload = Buffer.alloc(100, 0x30);
  return Buffer.concat([header, payload]);
}

function createTestWebp(): Buffer {
  // WebP starts with 'RIFF' (0..3) and 'WEBP' (8..11)
  const header = Buffer.from([
    0x52, 0x49, 0x46, 0x46, // 'RIFF'
    0x24, 0x00, 0x00, 0x00, // length
    0x57, 0x45, 0x42, 0x50, // 'WEBP'
  ]);
  const payload = Buffer.alloc(100, 0x40);
  return Buffer.concat([header, payload]);
}

async function runUploadTests() {
  console.log('====================================================');
  console.log('Portfolio CMS - Step 5 Media/Image Upload Test Suite');
  console.log('====================================================\n');

  // 1. Initialize offline PostgreSQL using pg-mem
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

  // 2. Set up Mock Storage Adapter
  const mockStorage = new MockStorageAdapter();
  StorageService.setAdapter(mockStorage);

  // 3. Create test users (admin and standard user)
  const adminId = crypto.randomUUID();
  const userId = crypto.randomUUID();
  const passwordHash = await AuthService.hashPassword('SuperAdmin123!');

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Portfolio Admin', 'admin@portfolio.test', passwordHash, 'admin']
  );

  await testPool.query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5);`,
    [userId, 'Standard Visitor', 'visitor@portfolio.test', passwordHash, 'user']
  );

  const adminToken = AuthService.generateAccessToken({ id: adminId, role: 'admin' });
  const userToken = AuthService.generateAccessToken({ id: userId, role: 'user' });

  // 4. Start HTTP test server
  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  async function request(
    options: http.RequestOptions,
    body?: Buffer | string
  ): Promise<{ status: number; headers: http.IncomingHttpHeaders; body: any }> {
    return new Promise((resolve, reject) => {
      const req = http.request(options, (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(c));
        res.on('end', () => {
          const raw = Buffer.concat(chunks).toString('utf-8');
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({ status: res.statusCode || 500, headers: res.headers, body: parsed });
        });
      });

      req.on('error', reject);
      if (body) {
        req.write(body);
      }
      req.end();
    });
  }

  try {
    console.log('--- 1. Validator Unit Tests ---');

    // Test 1: Allowed MIME types and extensions
    const mimeCheck =
      ALLOWED_MIME_TYPES.includes('image/jpeg') &&
      ALLOWED_MIME_TYPES.includes('image/png') &&
      ALLOWED_MIME_TYPES.includes('image/webp');
    recordTest(1, 'Supported image MIME types (JPEG, PNG, WebP) defined strictly', mimeCheck);

    // Test 2: File size limit constant is exactly 5 MB
    recordTest(2, 'Maximum file size limit set to 5 MB (5,242,880 bytes)', MAX_FILE_SIZE_BYTES === 5 * 1024 * 1024);

    // Test 3: Magic bytes detection for JPEG
    const jpegBuf = createTestJpeg();
    recordTest(3, 'JPEG magic byte inspection detects valid JPEG signature', validateMagicBytes(jpegBuf, 'image/jpeg'));

    // Test 4: Magic bytes detection for PNG
    const pngBuf = createTestPng();
    recordTest(4, 'PNG magic byte inspection detects valid PNG signature', validateMagicBytes(pngBuf, 'image/png'));

    // Test 5: Magic bytes detection for WebP
    const webpBuf = createTestWebp();
    recordTest(5, 'WebP magic byte inspection detects valid RIFF/WEBP signature', validateMagicBytes(webpBuf, 'image/webp'));

    // Test 6: Rejection of disguised shell script or binary
    const fakeBuf = Buffer.from('#!/bin/bash\necho "Malicious payload"\nexit 0;\n');
    const fakeRejected =
      !validateMagicBytes(fakeBuf, 'image/jpeg') &&
      !validateMagicBytes(fakeBuf, 'image/png') &&
      !validateMagicBytes(fakeBuf, 'image/webp');
    recordTest(6, 'Disguised shell script with fake MIME rejected by magic byte validator', fakeRejected);

    // Test 7: Validator rejects missing file
    let missingFileCaught = false;
    try {
      validateUploadedImage(undefined);
    } catch (err: any) {
      missingFileCaught = err.statusCode === 400;
    }
    recordTest(7, 'Validator rejects missing file parameter with 400 BadRequest', missingFileCaught);

    // Test 8: Validator rejects mismatched extension and MIME type (.png with image/jpeg)
    let mismatchCaught = false;
    try {
      validateUploadedImage({
        originalname: 'photo.png',
        mimetype: 'image/jpeg',
        size: 1000,
        buffer: jpegBuf,
      } as any);
    } catch (err: any) {
      mismatchCaught = err.statusCode === 400 && err.message.includes('does not match');
    }
    recordTest(8, 'Validator rejects extension/MIME mismatch (.png with image/jpeg)', mismatchCaught);

    // Test 9: Validator sanitizes original filename against directory traversal
    const pathTraversalFile = {
      originalname: '../../etc/passwd.jpg',
      mimetype: 'image/jpeg',
      size: jpegBuf.length,
      buffer: jpegBuf,
    };
    const sanitizedResult = validateUploadedImage(pathTraversalFile as any);
    recordTest(
      9,
      'Validator strips directory traversal paths from original filename metadata',
      sanitizedResult.sanitizedOriginalName === 'passwd.jpg'
    );

    console.log('\n--- 2. HTTP Endpoint Authentication & Authorization Tests ---');

    // Test 10: POST /api/upload/image without token -> 401
    const jpegPayload = createMultipartPayload('file', 'test.jpg', 'image/jpeg', jpegBuf);
    const resNoAuth = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          'Content-Type': jpegPayload.contentType,
          'Content-Length': jpegPayload.body.length,
        },
      },
      jpegPayload.body
    );
    recordTest(
      10,
      'POST /api/upload/image without Authorization header rejected (401)',
      resNoAuth.status === 401 && resNoAuth.body.success === false
    );

    // Test 11: POST /api/upload/image with invalid token -> 401
    const resInvalidToken = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: 'Bearer invalid.forged.jwt.token',
          'Content-Type': jpegPayload.contentType,
          'Content-Length': jpegPayload.body.length,
        },
      },
      jpegPayload.body
    );
    recordTest(
      11,
      'POST /api/upload/image with invalid token rejected (401)',
      resInvalidToken.status === 401 && resInvalidToken.body.success === false
    );

    // Test 12: POST /api/upload/image with authenticated non-admin user -> 403
    const resNonAdmin = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${userToken}`,
          'Content-Type': jpegPayload.contentType,
          'Content-Length': jpegPayload.body.length,
        },
      },
      jpegPayload.body
    );
    recordTest(
      12,
      'POST /api/upload/image with authenticated non-admin rejected (403 Forbidden)',
      resNonAdmin.status === 403 && resNonAdmin.body.success === false
    );

    console.log('\n--- 3. Validation & Image Format Handling ---');

    // Test 13: Missing file field (empty multipart payload) -> 400
    const emptyPayload = createMultipartPayload('', '', '', Buffer.alloc(0));
    const resMissingFile = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': emptyPayload.contentType,
          'Content-Length': emptyPayload.body.length,
        },
      },
      emptyPayload.body
    );
    recordTest(
      13,
      'POST /api/upload/image with missing file field rejected (400 Bad Request)',
      resMissingFile.status === 400 && resMissingFile.body.success === false
    );

    // Test 14: Valid JPEG upload with admin -> 201 Created
    const resJpeg = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': jpegPayload.contentType,
          'Content-Length': jpegPayload.body.length,
        },
      },
      jpegPayload.body
    );
    const jpegUploaded = resJpeg.status === 201 && resJpeg.body.data?.mime_type === 'image/jpeg';
    recordTest(14, 'POST /api/upload/image accepts valid JPEG with 201 Created', jpegUploaded);

    // Test 15: Valid PNG upload with admin -> 201 Created
    const pngPayload = createMultipartPayload('file', 'graphic.png', 'image/png', pngBuf);
    const resPng = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': pngPayload.contentType,
          'Content-Length': pngPayload.body.length,
        },
      },
      pngPayload.body
    );
    const pngUploaded = resPng.status === 201 && resPng.body.data?.mime_type === 'image/png';
    recordTest(15, 'POST /api/upload/image accepts valid PNG with 201 Created', pngUploaded);

    // Test 16: Valid WebP upload with admin -> 201 Created
    const webpPayload = createMultipartPayload('file', 'banner.webp', 'image/webp', webpBuf);
    const resWebp = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': webpPayload.contentType,
          'Content-Length': webpPayload.body.length,
        },
      },
      webpPayload.body
    );
    const webpUploaded = resWebp.status === 201 && resWebp.body.data?.mime_type === 'image/webp';
    recordTest(16, 'POST /api/upload/image accepts valid WebP with 201 Created', webpUploaded);

    // Test 17: Unsupported MIME type / file type (PDF file) -> 400
    const pdfBuf = Buffer.from('%PDF-1.4\n%...\n');
    const pdfPayload = createMultipartPayload('file', 'document.pdf', 'application/pdf', pdfBuf);
    const resPdf = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': pdfPayload.contentType,
          'Content-Length': pdfPayload.body.length,
        },
      },
      pdfPayload.body
    );
    recordTest(
      17,
      'POST /api/upload/image rejects unsupported format (.pdf) with 400 Bad Request',
      resPdf.status === 400 && resPdf.body.success === false
    );

    // Test 18: Oversized file (> 5 MB) rejected -> 400
    // Create buffer larger than 5 MB
    const oversizedBuf = Buffer.concat([jpegBuf, Buffer.alloc(5 * 1024 * 1024 + 1024, 0x55)]);
    const oversizedPayload = createMultipartPayload('file', 'huge.jpg', 'image/jpeg', oversizedBuf);
    const resOversized = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': oversizedPayload.contentType,
          'Content-Length': oversizedPayload.body.length,
        },
      },
      oversizedPayload.body
    );
    recordTest(
      18,
      'POST /api/upload/image rejects files larger than 5 MB with 400 Bad Request',
      resOversized.status === 400 && resOversized.body.message.includes('5 MB')
    );

    // Test 19: Disguised executable renamed as .jpg rejected -> 400
    const exeBuf = Buffer.from('MZ\x90\x00\x03\x00\x00\x00\x04\x00\x00\x00\xff\xff\x00\x00fake executable code');
    const disguisedPayload = createMultipartPayload('file', 'payload.jpg', 'image/jpeg', exeBuf);
    const resDisguised = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': disguisedPayload.contentType,
          'Content-Length': disguisedPayload.body.length,
        },
      },
      disguisedPayload.body
    );
    recordTest(
      19,
      'POST /api/upload/image rejects disguised executable (.exe renamed to .jpg) via magic byte check (400)',
      resDisguised.status === 400 && resDisguised.body.message.includes('signature')
    );

    console.log('\n--- 4. Database, Storage, and Security Verification ---');

    // Test 20: Stored media metadata in database matches upload specifications
    const mediaItem = resJpeg.body.data;
    const dbRecord = await testPool.query('SELECT * FROM media WHERE id = $1', [mediaItem.id]);
    const row = dbRecord.rows[0];
    const dbVerified =
      row &&
      row.filename.endsWith('.jpg') &&
      row.original_filename === 'test.jpg' &&
      row.storage_path.startsWith('images/') &&
      row.uploaded_by === adminId;
    recordTest(20, 'Database record created with correct filename, original_filename, and storage_path', dbVerified);

    // Test 21: uploaded_by comes strictly from authenticated admin JWT, ignoring user-supplied uploaded_by
    const spoofedUserPayload = createMultipartPayload(
      'file',
      'avatar.png',
      'image/png',
      pngBuf,
      { uploaded_by: userId } // attempted spoof
    );
    const resSpoof = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': spoofedUserPayload.contentType,
          'Content-Length': spoofedUserPayload.body.length,
        },
      },
      spoofedUserPayload.body
    );
    const spoofRecord = await testPool.query('SELECT * FROM media WHERE id = $1', [resSpoof.body.data.id]);
    recordTest(
      21,
      'Backend ignores user-supplied uploaded_by and enforces authenticated admin ID',
      spoofRecord.rows[0].uploaded_by === adminId
    );

    // Test 22: Safe unique filename generation prevents path traversal
    const pathAttackPayload = createMultipartPayload(
      'file',
      '../../../../etc/passwd.png',
      'image/png',
      pngBuf
    );
    const resPathAttack = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': pathAttackPayload.contentType,
          'Content-Length': pathAttackPayload.body.length,
        },
      },
      pathAttackPayload.body
    );
    const pathAttackRecord = resPathAttack.body.data;
    const isSafePath =
      !pathAttackRecord.storage_path.includes('..') &&
      pathAttackRecord.storage_path.startsWith('images/') &&
      pathAttackRecord.original_filename === 'passwd.png';
    recordTest(22, 'Generated filename is cryptographically safe UUID preventing path traversal', isSafePath);

    // Test 23: Database insertion failure triggers storage cleanup rollback
    mockStorage.reset();
    let rollbackTriggered = false;
    // We simulate a DB failure by temporarily overriding the pool with an invalid one
    setDbPool(null);
    try {
      await UploadService.uploadImage({
        file: {
          originalname: 'rollback-test.jpg',
          mimetype: 'image/jpeg',
          size: jpegBuf.length,
          buffer: jpegBuf,
        } as any,
        userId: adminId,
      });
    } catch (err: any) {
      // Check if delete was called on mockStorage to clean up orphan file
      rollbackTriggered = mockStorage.deletedFiles.length > 0;
    }
    // Restore pool
    setDbPool(testPool as any);
    recordTest(23, 'Database failure triggers immediate storage cleanup rollback (no orphan files)', rollbackTriggered);

    // Test 24: Storage upload failure does not create a database record
    mockStorage.reset();
    mockStorage.shouldFailUpload = true;
    const mediaCountBefore = (await testPool.query('SELECT COUNT(*) FROM media;')).rows[0].count;
    let storageFailCaught = false;
    try {
      await UploadService.uploadImage({
        file: {
          originalname: 'fail-storage.jpg',
          mimetype: 'image/jpeg',
          size: jpegBuf.length,
          buffer: jpegBuf,
        } as any,
        userId: adminId,
      });
    } catch (err: any) {
      storageFailCaught = true;
    }
    const mediaCountAfter = (await testPool.query('SELECT COUNT(*) FROM media;')).rows[0].count;
    recordTest(
      24,
      'Storage failure aborts flow and creates 0 database records',
      storageFailCaught && mediaCountBefore === mediaCountAfter
    );

    // Reset mockStorage state for subsequent tests
    mockStorage.reset();

    // Test 25: Sensitive credentials strictly omitted from API responses
    const resString = JSON.stringify(resJpeg.body);
    const noSensitiveData =
      !resString.includes('service_role') &&
      !resString.includes('password_hash') &&
      !resString.includes('SUPABASE_SERVICE_ROLE_KEY') &&
      !resString.includes('JWT_ACCESS_SECRET');
    recordTest(25, 'API responses strictly omit sensitive credentials, service-role keys, and hashes', noSensitiveData);

    // Test 26: GET /api/upload (List uploaded media) requires admin and returns list
    const resList = await request({
      hostname: '127.0.0.1',
      port: address.port,
      path: '/api/upload',
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(
      26,
      'GET /api/upload returns list of uploaded media records for authenticated admin',
      resList.status === 200 && Array.isArray(resList.body.data) && resList.body.data.length >= 2
    );

    // Test 27: GET /api/upload/:id returns single media details
    const resGetOne = await request({
      hostname: '127.0.0.1',
      port: address.port,
      path: `/api/upload/${mediaItem.id}`,
      method: 'GET',
      headers: {
        Authorization: `Bearer ${adminToken}`,
      },
    });
    recordTest(
      27,
      'GET /api/upload/:id returns specific media record for authenticated admin',
      resGetOne.status === 200 && resGetOne.body.data?.id === mediaItem.id
    );

    // Test 28: Parameterized SQL prevents SQL injection in original_filename
    const sqliPayload = createMultipartPayload(
      'file',
      "photo'; DROP TABLE media; --.png",
      'image/png',
      pngBuf
    );
    const resSqli = await request(
      {
        hostname: '127.0.0.1',
        port: address.port,
        path: '/api/upload/image',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': sqliPayload.contentType,
          'Content-Length': sqliPayload.body.length,
        },
      },
      sqliPayload.body
    );
    // Verify media table still exists
    const checkTable = await testPool.query('SELECT COUNT(*) FROM media;');
    recordTest(
      28,
      'SQL injection attempt via filename safely escaped via parameterized queries',
      resSqli.status === 201 && Number(checkTable.rows[0].count) > 0
    );

  } finally {
    server.close();
  }

  // Summary
  const passedCount = testResults.filter((t) => t.passed).length;
  const failedCount = testResults.filter((t) => !t.passed).length;

  console.log('\n====================================================');
  console.log(`Step 5 Upload Test Summary: Total: ${testResults.length} | Passed: ${passedCount} | Failed: ${failedCount}`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runUploadTests().catch((err) => {
  console.error('Fatal test runner error:', err);
  process.exit(1);
});
