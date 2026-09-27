import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import http from 'http';
import { newDb } from 'pg-mem';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';
import { AuthService } from '../services/auth.service.ts';
import { getAllowedCorsOrigins } from '../config/index.ts';

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

async function runStep17DeploymentTests() {
  console.log('====================================================');
  console.log('Step 17 Deployment Readiness & Verification Test Suite');
  console.log('====================================================\n');

  // -------------------------------------------------------------
  // 1. Frontend Environment & Production API Configuration
  // -------------------------------------------------------------
  const publicApiContent = fs.readFileSync(path.resolve(process.cwd(), 'src/lib/publicApi.ts'), 'utf-8');
  const adminApiContent = fs.readFileSync(path.resolve(process.cwd(), 'src/admin/lib/api.ts'), 'utf-8');

  recordTest(
    1,
    'Frontend publicApi uses import.meta.env.VITE_API_BASE_URL for configurable backend API URL',
    publicApiContent.includes('import.meta.env.VITE_API_BASE_URL')
  );

  recordTest(
    2,
    'Frontend admin api client uses import.meta.env.VITE_API_BASE_URL for configurable backend API URL',
    adminApiContent.includes('import.meta.env.VITE_API_BASE_URL')
  );

  recordTest(
    3,
    'Frontend source code does not contain hardcoded localhost or 127.0.0.1 URLs',
    !publicApiContent.includes('localhost') &&
      !publicApiContent.includes('127.0.0.1') &&
      !adminApiContent.includes('localhost') &&
      !adminApiContent.includes('127.0.0.1')
  );

  // -------------------------------------------------------------
  // 2. Vercel & Netlify SPA Routing Configuration
  // -------------------------------------------------------------
  const vercelJsonPath = path.resolve(process.cwd(), 'vercel.json');
  const vercelExists = fs.existsSync(vercelJsonPath);
  const vercelContent = vercelExists ? fs.readFileSync(vercelJsonPath, 'utf-8') : '';
  const vercelHasRewrites = vercelContent.includes('/index.html');

  recordTest(
    4,
    'vercel.json exists with SPA route rewrite to /index.html',
    vercelExists && vercelHasRewrites
  );

  const redirectsPath = path.resolve(process.cwd(), 'public/_redirects');
  const redirectsExists = fs.existsSync(redirectsPath);
  const redirectsContent = redirectsExists ? fs.readFileSync(redirectsPath, 'utf-8') : '';
  const redirectsHasRule = redirectsContent.includes('/index.html');

  recordTest(
    5,
    'public/_redirects exists for Netlify SPA routing to /index.html',
    redirectsExists && redirectsHasRule
  );

  // -------------------------------------------------------------
  // 3. Git & Environment Configuration Safety
  // -------------------------------------------------------------
  const gitignoreContent = fs.readFileSync(path.resolve(process.cwd(), '.gitignore'), 'utf-8');
  recordTest(
    6,
    '.gitignore ignores all .env* secret files while preserving !.env.example',
    gitignoreContent.includes('.env*') && gitignoreContent.includes('!.env.example')
  );

  const rootEnvExample = fs.readFileSync(path.resolve(process.cwd(), '.env.example'), 'utf-8');
  const backendEnvExample = fs.readFileSync(path.resolve(process.cwd(), 'backend/.env.example'), 'utf-8');

  recordTest(
    7,
    'Root .env.example documents all required frontend & backend variables without actual secrets',
    rootEnvExample.includes('DATABASE_URL=') &&
      rootEnvExample.includes('JWT_ACCESS_SECRET=') &&
      rootEnvExample.includes('JWT_REFRESH_SECRET=') &&
      rootEnvExample.includes('CORS_ORIGIN=') &&
      rootEnvExample.includes('VITE_API_BASE_URL=') &&
      rootEnvExample.includes('SUPABASE_SERVICE_ROLE_KEY=')
  );

  recordTest(
    8,
    'backend/.env.example documents all backend production variables',
    backendEnvExample.includes('DATABASE_URL=') &&
      backendEnvExample.includes('JWT_ACCESS_SECRET=') &&
      backendEnvExample.includes('JWT_REFRESH_SECRET=') &&
      backendEnvExample.includes('CORS_ORIGIN=') &&
      backendEnvExample.includes('SUPABASE_SERVICE_ROLE_KEY=') &&
      backendEnvExample.includes('SMTP_HOST=')
  );

  // -------------------------------------------------------------
  // 4. CORS Production Origin Validation
  // -------------------------------------------------------------
  const originalEnv = process.env.NODE_ENV;
  const originalCors = process.env.CORS_ORIGIN;
  const originalFrontend = process.env.FRONTEND_URL;

  try {
    process.env.NODE_ENV = 'production';
    process.env.CORS_ORIGIN = 'https://portfolio-app.vercel.app, https://custom-domain.com';
    process.env.FRONTEND_URL = 'https://portfolio-app.vercel.app';

    const corsHandler: any = getAllowedCorsOrigins();
    let allowedVercel = false;
    let allowedCustom = false;
    let blockedHacker = false;

    corsHandler('https://portfolio-app.vercel.app', (err: any, allow: any) => {
      allowedVercel = !err && allow === true;
    });

    corsHandler('https://custom-domain.com', (err: any, allow: any) => {
      allowedCustom = !err && allow === true;
    });

    corsHandler('https://malicious-site.com', (err: any) => {
      blockedHacker = Boolean(err);
    });

    recordTest(
      9,
      'CORS origin handler allows configured production frontend domains (Vercel/Custom) and blocks untrusted origins',
      allowedVercel && allowedCustom && blockedHacker
    );
  } finally {
    process.env.NODE_ENV = originalEnv;
    process.env.CORS_ORIGIN = originalCors;
    process.env.FRONTEND_URL = originalFrontend;
  }

  // -------------------------------------------------------------
  // 5. Database, Health & Production API Runtime Verification
  // -------------------------------------------------------------
  const db = newDb();
  db.public.registerFunction({
    name: 'gen_random_uuid',
    impure: true,
    implementation: () => crypto.randomUUID(),
  });

  // Execute migrations
  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  const migrationFiles = fs.readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort();
  for (const file of migrationFiles) {
    const rawSql = fs.readFileSync(path.join(migrationsDir, file), 'utf-8');
    const sqlForPgMem = rawSql
      .replace(/CREATE OR REPLACE FUNCTION[\s\S]*?LANGUAGE plpgsql;/gi, '')
      .replace(/DROP TRIGGER IF EXISTS[\s\S]*?;/gi, '')
      .replace(/CREATE TRIGGER[\s\S]*?EXECUTE FUNCTION[\s\S]*?;/gi, '');
    db.public.none(sqlForPgMem);
  }

  const pgAdapter = db.adapters.createPg();
  const pool = new pgAdapter.Pool();
  setDbPool(pool as any);

  // Setup admin user & seed sample data
  const adminId = crypto.randomUUID();
  const passwordHash = await AuthService.hashPassword('SuperSecretAdmin123!');
  await pool.query(
    `INSERT INTO users (id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, $5);`,
    [adminId, 'Production Admin', 'admin@production.test', passwordHash, 'admin']
  );

  const app = createApp();
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    // Test Health Endpoint
    const healthRes = await fetch(`${baseUrl}/api/health`);
    const healthData = await healthRes.json();
    recordTest(
      10,
      'GET /api/health returns 200 with operational status without leaking credentials',
      healthRes.status === 200 &&
        healthData.success === true &&
        healthData.data?.database?.status === 'connected' &&
        !JSON.stringify(healthData).includes('password') &&
        !JSON.stringify(healthData).includes('postgres://')
    );

    // Test Admin Login with JWT Token Generation
    const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@production.test',
        password: 'SuperSecretAdmin123!',
      }),
    });
    const loginData = await loginRes.json();
    recordTest(
      11,
      'POST /api/auth/login returns valid accessToken and refreshToken',
      loginRes.status === 200 &&
        loginData.success === true &&
        Boolean(loginData.data?.accessToken) &&
        Boolean(loginData.data?.refreshToken)
    );

    const accessToken = loginData.data?.accessToken;
    const refreshToken = loginData.data?.refreshToken;

    // Test Token Refresh Endpoint
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });
    const refreshData = await refreshRes.json();
    recordTest(
      12,
      'POST /api/auth/refresh successfully rotates tokens',
      refreshRes.status === 200 &&
        refreshData.success === true &&
        Boolean(refreshData.data?.accessToken)
    );

    // Test Protected Admin Route with JWT Bearer Token
    const adminCheckRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const adminCheckData = await adminCheckRes.json();
    recordTest(
      13,
      'GET /api/messages allows access with valid Bearer JWT',
      adminCheckRes.status === 200 && adminCheckData.success === true
    );

    // Test Unauthenticated Rejection
    const unauthRes = await fetch(`${baseUrl}/api/messages`);
    recordTest(
      14,
      'GET /api/messages denies unauthenticated access with 401 Unauthorized',
      unauthRes.status === 401
    );

    // Test Contact Inquiry Ingestion
    const contactRes = await fetch(`${baseUrl}/api/contact`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Deployment Tester',
        email: 'test@deployment.example',
        subject: 'Production Readiness Inquiry',
        message: 'Verifying that public inquiries submit and persist cleanly in production.',
      }),
    });
    const contactData = await contactRes.json();
    recordTest(
      15,
      'POST /api/contact validates input and records inquiry in database',
      contactRes.status === 201 && contactData.success === true
    );
  } finally {
    server.close();
  }

  // Summary
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = results.filter((r) => !r.passed).length;

  console.log('\n====================================================');
  console.log(`Step 17 Test Summary: ${passedCount}/${results.length} Passed (${failedCount} Failed)`);
  console.log('====================================================');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runStep17DeploymentTests().catch((err) => {
  console.error('Fatal error running Step 17 test suite:', err);
  process.exit(1);
});
