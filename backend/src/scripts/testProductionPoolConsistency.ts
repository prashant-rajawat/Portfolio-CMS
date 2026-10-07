import { getDbPool, testDatabaseConnection, setDbPool } from '../db/index.ts';
import { AboutService } from '../services/about.service.ts';
import fs from 'fs';
import path from 'path';

async function runProductionConsistencyAudit() {
  console.log('================================================================');
  console.log('Production Database Pool Consistency & Isolation Verification');
  console.log('================================================================');

  // Mock pool interface adhering to real pg.Pool query signatures for offline test
  let aboutQueryExecuted = false;
  let healthQueryExecuted = false;

  const mockClient = {
    query: async (sql: string) => {
      if (sql.includes('SELECT 1')) {
        healthQueryExecuted = true;
        return { rows: [{ alive: 1 }] };
      }
      return { rows: [] };
    },
    release: () => {},
  };

  const sharedMockPool: any = {
    connect: async () => mockClient,
    query: async (sql: string, params?: any[]) => {
      if (sql.includes('about')) {
        aboutQueryExecuted = true;
        return {
          rows: [
            {
              id: 'test-about-uuid',
              title: 'Senior Software Engineer',
              short_description: 'Building robust scalable applications',
              full_description: 'Full stack development and system architecture.',
              profile_image_url: 'https://example.com/avatar.jpg',
              resume_url: null,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ],
        };
      }
      return { rows: [] };
    },
    on: () => {},
    end: async () => {},
  };

  // Inject shared pool
  setDbPool(sharedMockPool);

  // 1. Verify pool instance identity
  const poolFromDb = getDbPool();
  if (poolFromDb !== sharedMockPool) {
    throw new Error('FAIL: getDbPool() did not return the active pool instance!');
  }
  console.log('✓ PASS: Shared Pool instance is uniquely identified');

  // 2. Run Database Health Check
  const healthResult = await testDatabaseConnection();
  if (healthResult.status !== 'connected' || !healthQueryExecuted) {
    throw new Error(`FAIL: testDatabaseConnection() failed: ${JSON.stringify(healthResult)}`);
  }
  console.log('✓ PASS: testDatabaseConnection() succeeded using active pool');

  // 3. Run AboutService query and verify it hits the exact same pool
  const aboutRecord = await AboutService.getAbout();
  if (!aboutRecord || aboutRecord.id !== 'test-about-uuid' || !aboutQueryExecuted) {
    throw new Error('FAIL: AboutService.getAbout() did not execute query against the active pool!');
  }
  console.log('✓ PASS: AboutService.getAbout() successfully executed query against the exact same pool');

  // 4. Verify that PostgreSQL authentication errors are NOT silently swallowed
  const failingMockPool: any = {
    connect: async () => {
      throw new Error('password authentication failed for user "postgres"');
    },
    query: async () => {
      throw new Error('password authentication failed for user "postgres"');
    },
    on: () => {},
    end: async () => {},
  };

  setDbPool(failingMockPool);

  let errorThrown = false;
  try {
    await AboutService.getAbout();
  } catch (err: any) {
    if (err.message.includes('password authentication failed')) {
      errorThrown = true;
    }
  }

  if (!errorThrown) {
    throw new Error('FAIL: PostgreSQL authentication error was silently swallowed by AboutService!');
  }
  console.log('✓ PASS: PostgreSQL authentication errors propagate visibly without silent suppression');

  // 5. Verify no pg-mem in production bundle
  const distPath = path.resolve('dist/server.cjs');
  if (fs.existsSync(distPath)) {
    const distContent = fs.readFileSync(distPath, 'utf8');
    if (distContent.includes('pg-mem') || distContent.includes('newDb')) {
      throw new Error('FAIL: pg-mem found in dist/server.cjs!');
    }
    console.log('✓ PASS: dist/server.cjs verified clean (zero pg-mem references)');
  } else {
    console.log('ℹ NOTE: dist/server.cjs not yet generated, build will verify');
  }

  // Reset pool
  setDbPool(null);

  console.log('================================================================');
  console.log('All Consistency & Pool Isolation Checks Passed!');
  console.log('================================================================');
}

runProductionConsistencyAudit().catch((err) => {
  console.error('Audit failed:', err);
  process.exit(1);
});
