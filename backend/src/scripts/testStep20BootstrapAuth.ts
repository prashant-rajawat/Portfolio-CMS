import http from 'http';
import bcrypt from 'bcryptjs';
import { setDbPool } from '../db/index.ts';
import { createApp } from '../app.ts';

async function runStep20BootstrapAuthTest() {
  console.log('================================================================');
  console.log('Step 20: Comprehensive Admin Authentication & Bootstrap Test');
  console.log('================================================================');

  const app = createApp();
  const server = http.createServer(app);

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address() as any;
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const testDbAdminPassword = 'DatabaseAdminPassword123!';
  const testDbAdminHash = await bcrypt.hash(testDbAdminPassword, 10);

  const testBootstrapPassword = 'BootstrapEmergencyPassword123!';
  const testBootstrapHash = await bcrypt.hash(testBootstrapPassword, 10);
  const testBootstrapEmail = 'bootstrap.admin@portfolio.local';

  // 1. Setup Mock DB Pool with Admin and Non-Admin users
  const mockHealthyDbPool: any = {
    connect: async () => ({
      query: async () => ({ rows: [{ alive: 1 }] }),
      release: () => {},
    }),
    query: async (sql: string, params?: any[]) => {
      const normalizedSql = sql.toLowerCase().replace(/\s+/g, ' ');
      if (normalizedSql.includes('from users') && normalizedSql.includes('email')) {
        const emailParam = (params?.[0] || '').toLowerCase();
        if (emailParam === 'db.admin@portfolio.local') {
          return {
            rows: [
              {
                id: 'db-admin-uuid-1234',
                name: 'Database Administrator',
                email: 'db.admin@portfolio.local',
                password_hash: testDbAdminHash,
                role: 'admin',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }
        if (emailParam === 'viewer@portfolio.local') {
          return {
            rows: [
              {
                id: 'db-viewer-uuid-5678',
                name: 'Standard Viewer',
                email: 'viewer@portfolio.local',
                password_hash: testDbAdminHash,
                role: 'viewer',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }
        return { rows: [] };
      }

      if (normalizedSql.includes('from users') && normalizedSql.includes('where id = $1')) {
        const idParam = params?.[0];
        if (idParam === 'db-admin-uuid-1234') {
          return {
            rows: [
              {
                id: 'db-admin-uuid-1234',
                name: 'Database Administrator',
                email: 'db.admin@portfolio.local',
                password_hash: testDbAdminHash,
                role: 'admin',
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ],
          };
        }
        return { rows: [] };
      }

      if (sql.includes('information_schema.tables') && sql.includes('refresh_tokens')) {
        return { rows: [{ exists: true }] };
      }

      if (sql.includes('INSERT INTO refresh_tokens') || sql.includes('UPDATE refresh_tokens')) {
        return { rows: [] };
      }

      if (sql.includes('SELECT id, user_id, expires_at, revoked_at FROM refresh_tokens')) {
        return {
          rows: [
            {
              id: 'token-uuid-1',
              user_id: 'db-admin-uuid-1234',
              expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
              revoked_at: null,
            },
          ],
        };
      }

      return { rows: [] };
    },
    on: () => {},
    end: async () => {},
  };

  try {
    // -------------------------------------------------------------
    // Test 1: Normal Database Admin Login
    // -------------------------------------------------------------
    setDbPool(mockHealthyDbPool);
    const dbLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'db.admin@portfolio.local', password: testDbAdminPassword }),
    });
    const dbLoginData: any = await dbLoginRes.json();

    if (dbLoginRes.status !== 200 || !dbLoginData.data?.accessToken || dbLoginData.data?.user?.role !== 'admin') {
      throw new Error(`FAIL: Normal DB login failed: ${JSON.stringify(dbLoginData)}`);
    }
    console.log('✓ PASS 1: Normal database admin login succeeded with valid JWT');

    // -------------------------------------------------------------
    // Test 2: Invalid Database Password
    // -------------------------------------------------------------
    const dbWrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'db.admin@portfolio.local', password: 'WrongPassword123!' }),
    });
    const dbWrongPassData: any = await dbWrongPassRes.json();

    const getErrMsg = (d: any) => d.message || d.error || '';

    if (dbWrongPassRes.status !== 401 || !getErrMsg(dbWrongPassData).includes('Invalid email or password')) {
      throw new Error(`FAIL: Wrong DB password did not return 401: ${JSON.stringify(dbWrongPassData)}`);
    }
    console.log('✓ PASS 2: Invalid database password returned generic 401');

    // -------------------------------------------------------------
    // Test 3: Non-Admin Role Authorization Check (requireAdmin -> 403)
    // -------------------------------------------------------------
    const nonAdminLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'viewer@portfolio.local', password: testDbAdminPassword }),
    });
    const nonAdminLoginData: any = await nonAdminLoginRes.json();
    const viewerToken = nonAdminLoginData.data?.accessToken;

    const nonAdminAccessRes = await fetch(`${baseUrl}/api/messages`, {
      headers: { Authorization: `Bearer ${viewerToken}` },
    });
    const nonAdminAccessData: any = await nonAdminAccessRes.json();

    if (nonAdminAccessRes.status !== 403 || !getErrMsg(nonAdminAccessData).includes('Administrator privileges required')) {
      throw new Error(`FAIL: Non-admin role was not rejected with 403 by requireAdmin: ${JSON.stringify(nonAdminAccessData)}`);
    }
    console.log('✓ PASS 3: Non-admin role correctly rejected with 403 by requireAdmin');

    // -------------------------------------------------------------
    // Setup Failing DB Mock (simulate PostgreSQL disconnect / auth error)
    // -------------------------------------------------------------
    const mockFailingDbPool: any = {
      connect: async () => {
        throw new Error('password authentication failed for user "postgres"');
      },
      query: async () => {
        throw new Error('password authentication failed for user "postgres"');
      },
      on: () => {},
      end: async () => {},
    };
    setDbPool(mockFailingDbPool);

    // -------------------------------------------------------------
    // Test 4: Database Unavailable with NO Bootstrap configured -> 503
    // -------------------------------------------------------------
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;

    const noBootstrapRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'any@example.com', password: 'AnyPassword123!' }),
    });
    const noBootstrapData: any = await noBootstrapRes.json();

    if (noBootstrapRes.status !== 503 || !getErrMsg(noBootstrapData).includes('Database service is unavailable')) {
      throw new Error(`FAIL: DB unavailable without bootstrap did not return 503: ${JSON.stringify(noBootstrapData)}`);
    }
    console.log('✓ PASS 4: Database unavailable without bootstrap returns 503');

    // -------------------------------------------------------------
    // Configure Bootstrap Environment Variables
    // -------------------------------------------------------------
    process.env.ADMIN_BOOTSTRAP_EMAIL = testBootstrapEmail;
    process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH = testBootstrapHash;

    // -------------------------------------------------------------
    // Test 5: Bootstrap Admin Login when Database is Unavailable
    // -------------------------------------------------------------
    const bootstrapLoginRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testBootstrapEmail, password: testBootstrapPassword }),
    });
    const bootstrapLoginData: any = await bootstrapLoginRes.json();

    if (bootstrapLoginRes.status !== 200 || !bootstrapLoginData.data?.accessToken || bootstrapLoginData.data?.user?.role !== 'admin') {
      throw new Error(`FAIL: Bootstrap admin login failed: ${JSON.stringify(bootstrapLoginData)}`);
    }
    const bootstrapAccessToken = bootstrapLoginData.data.accessToken;
    const bootstrapRefreshToken = bootstrapLoginData.data.refreshToken;
    console.log('✓ PASS 5: Emergency bootstrap admin login succeeded when DB is unavailable');

    // -------------------------------------------------------------
    // Test 6: Wrong Bootstrap Password -> 401
    // -------------------------------------------------------------
    const bootstrapWrongPassRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testBootstrapEmail, password: 'WrongBootstrapPassword123!' }),
    });
    const bootstrapWrongPassData: any = await bootstrapWrongPassRes.json();

    if (bootstrapWrongPassRes.status !== 401 || !getErrMsg(bootstrapWrongPassData).includes('Invalid email or password')) {
      throw new Error(`FAIL: Wrong bootstrap password did not return 401: ${JSON.stringify(bootstrapWrongPassData)}`);
    }
    console.log('✓ PASS 6: Wrong bootstrap password returned generic 401');

    // -------------------------------------------------------------
    // Test 7: Bootstrap Email Mismatch -> 401
    // -------------------------------------------------------------
    const bootstrapWrongEmailRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'other.user@example.com', password: testBootstrapPassword }),
    });
    const bootstrapWrongEmailData: any = await bootstrapWrongEmailRes.json();

    if (bootstrapWrongEmailRes.status !== 401 || !getErrMsg(bootstrapWrongEmailData).includes('Invalid email or password')) {
      throw new Error(`FAIL: Mismatched bootstrap email did not return 401: ${JSON.stringify(bootstrapWrongEmailData)}`);
    }
    console.log('✓ PASS 7: Mismatched bootstrap email returned generic 401 without revealing config');

    // -------------------------------------------------------------
    // Test 8: Protected Admin Endpoint with Access Token
    // -------------------------------------------------------------
    const meRes = await fetch(`${baseUrl}/api/auth/me`, {
      headers: { Authorization: `Bearer ${bootstrapAccessToken}` },
    });
    const meData: any = await meRes.json();

    if (meRes.status !== 200 || meData.data?.role !== 'admin') {
      throw new Error(`FAIL: Protected /api/auth/me failed with bootstrap access token: ${JSON.stringify(meData)}`);
    }
    console.log('✓ PASS 8: Protected admin route successfully authenticated bootstrap access token');

    // -------------------------------------------------------------
    // Test 9: Refresh Token Rotation
    // -------------------------------------------------------------
    const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: bootstrapRefreshToken }),
    });
    const refreshData: any = await refreshRes.json();

    if (refreshRes.status !== 200 || !refreshData.data?.accessToken || refreshData.data?.user?.role !== 'admin') {
      throw new Error(`FAIL: Bootstrap refresh token rotation failed: ${JSON.stringify(refreshData)}`);
    }
    console.log('✓ PASS 9: Refresh token rotation issued new valid tokens');

    // -------------------------------------------------------------
    // Test 10: Database Normal Login Priority when DB Restored
    // -------------------------------------------------------------
    setDbPool(mockHealthyDbPool);
    const restoredDbRes = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'db.admin@portfolio.local', password: testDbAdminPassword }),
    });
    const restoredDbData: any = await restoredDbRes.json();

    if (restoredDbRes.status !== 200 || restoredDbData.data?.user?.email !== 'db.admin@portfolio.local') {
      throw new Error(`FAIL: Normal DB login did not take priority after DB restoration: ${JSON.stringify(restoredDbData)}`);
    }
    console.log('✓ PASS 10: Normal database authentication immediately prioritized when PostgreSQL is healthy');
  } finally {
    // Cleanup
    delete process.env.ADMIN_BOOTSTRAP_EMAIL;
    delete process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH;
    setDbPool(null);
    server.close();
  }

  console.log('================================================================');
  console.log('All 10 Step 20 Authentication & Bootstrap Checks Passed!');
  console.log('================================================================');
}

runStep20BootstrapAuthTest().catch((err) => {
  console.error('Step 20 Test failed:', err);
  process.exit(1);
});
