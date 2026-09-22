import { getDbPool, testDatabaseConnection } from './index.ts';
import { logger } from '../utils/logger.ts';
import { config } from '../config/index.ts';

export const REQUIRED_TABLES = [
  'users',
  'about',
  'skills',
  'projects',
  'blogs',
  'experience',
  'testimonials',
  'services',
  'messages',
  'media',
] as const;

export type RequiredTable = (typeof REQUIRED_TABLES)[number];

export interface TableVerificationResult {
  table: RequiredTable;
  exists: boolean;
  columnCount?: number;
}

export interface DatabaseVerificationReport {
  databaseConnected: boolean;
  migrationStatus: 'PASS' | 'FAIL' | 'NOT_APPLIED';
  appliedMigrationCount: number;
  tableResults: Record<RequiredTable, 'PASS' | 'FAIL'>;
  crudTestResult?: {
    insert: 'PASS' | 'FAIL';
    select: 'PASS' | 'FAIL';
    update: 'PASS' | 'FAIL';
    delete: 'PASS' | 'FAIL';
    uniqueConstraint: 'PASS' | 'FAIL';
    foreignKey: 'PASS' | 'FAIL';
  };
  summary: 'PASS' | 'FAIL';
  message: string;
}

/**
 * Runs a comprehensive verification of the database structure and operations.
 */
export async function verifyDatabase(): Promise<DatabaseVerificationReport> {
  const initialCheck = await testDatabaseConnection();

  if (initialCheck.status !== 'connected') {
    const tableFailures = REQUIRED_TABLES.reduce(
      (acc, table) => ({ ...acc, [table]: 'FAIL' }),
      {} as Record<RequiredTable, 'PASS' | 'FAIL'>
    );

    return {
      databaseConnected: false,
      migrationStatus: 'FAIL',
      appliedMigrationCount: 0,
      tableResults: tableFailures,
      summary: 'FAIL',
      message:
        config.databaseUrl
          ? 'Database unreachable. Please verify DATABASE_URL.'
          : 'Database not configured. Provide DATABASE_URL in .env to run verification.',
    };
  }

  const pool = getDbPool();
  if (!pool) {
    throw new Error('Database pool unavailable');
  }

  const client = await pool.connect();

  try {
    // 1. Check migrations table
    let migrationStatus: 'PASS' | 'FAIL' | 'NOT_APPLIED' = 'NOT_APPLIED';
    let appliedCount = 0;

    const migrationTableCheck = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'schema_migrations'
      );
    `);

    if (migrationTableCheck.rows[0].exists) {
      const migrationsRes = await client.query('SELECT COUNT(*)::int AS count FROM schema_migrations;');
      appliedCount = migrationsRes.rows[0].count;
      migrationStatus = appliedCount >= REQUIRED_TABLES.length ? 'PASS' : 'FAIL';
    }

    // 2. Check each required table existence
    const tableQuery = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name = ANY($1::text[]);
    `, [REQUIRED_TABLES]);

    const existingTableSet = new Set(tableQuery.rows.map((row: { table_name: string }) => row.table_name));

    const tableResults = {} as Record<RequiredTable, 'PASS' | 'FAIL'>;
    let allTablesExist = true;

    for (const table of REQUIRED_TABLES) {
      if (existingTableSet.has(table)) {
        tableResults[table] = 'PASS';
      } else {
        tableResults[table] = 'FAIL';
        allTablesExist = false;
      }
    }

    // 3. Test basic CRUD & constraints if all required tables exist
    let crudResult: DatabaseVerificationReport['crudTestResult'];
    if (allTablesExist) {
      crudResult = await runCrudOperationsTest(client);
    }

    const overallSuccess =
      allTablesExist &&
      migrationStatus === 'PASS' &&
      (!crudResult || Object.values(crudResult).every((val) => val === 'PASS'));

    return {
      databaseConnected: true,
      migrationStatus,
      appliedMigrationCount: appliedCount,
      tableResults,
      crudTestResult: crudResult,
      summary: overallSuccess ? 'PASS' : 'FAIL',
      message: overallSuccess
        ? 'All required database entities, constraints, and migrations verified successfully.'
        : 'One or more database verification checks failed.',
    };
  } finally {
    client.release();
  }
}

/**
 * Executes a safe, self-contained test of INSERT, SELECT, UPDATE, DELETE,
 * unique constraint enforcement, and foreign key relations.
 * Always cleans up test records.
 */
async function runCrudOperationsTest(client: {
  query: (text: string, values?: unknown[]) => Promise<{ rows: any[] }>;
}): Promise<NonNullable<DatabaseVerificationReport['crudTestResult']>> {
  const testId = `test_${Date.now()}`;
  const testEmail = `test_${Date.now()}@testportfolio.local`;
  let userId: string | null = null;
  let blogId: string | null = null;

  const results: NonNullable<DatabaseVerificationReport['crudTestResult']> = {
    insert: 'FAIL',
    select: 'FAIL',
    update: 'FAIL',
    delete: 'FAIL',
    uniqueConstraint: 'FAIL',
    foreignKey: 'FAIL',
  };

  try {
    // 1. Test INSERT
    const insertRes = await client.query(
      `INSERT INTO users (name, email, password_hash, role) 
       VALUES ($1, $2, $3, $4) 
       RETURNING id, name, email;`,
      ['Test Admin', testEmail, '$2b$10$temporarytestpasswordhashvalue', 'admin']
    );

    if (insertRes.rows.length === 1 && insertRes.rows[0].id) {
      userId = insertRes.rows[0].id;
      results.insert = 'PASS';
    }

    // 2. Test SELECT
    if (userId) {
      const selectRes = await client.query('SELECT id, name, email FROM users WHERE id = $1;', [userId]);
      if (selectRes.rows.length === 1 && selectRes.rows[0].email === testEmail) {
        results.select = 'PASS';
      }
    }

    // 3. Test UPDATE
    if (userId) {
      const updateRes = await client.query(
        `UPDATE users SET name = $1 WHERE id = $2 RETURNING name;`,
        ['Updated Test Admin', userId]
      );
      if (updateRes.rows.length === 1 && updateRes.rows[0].name === 'Updated Test Admin') {
        results.update = 'PASS';
      }
    }

    // 4. Test Unique Constraint on users.email
    if (userId) {
      try {
        await client.query(
          `INSERT INTO users (name, email, password_hash, role) 
           VALUES ($1, $2, $3, $4);`,
          ['Duplicate User', testEmail, 'dummyhash', 'admin']
        );
        results.uniqueConstraint = 'FAIL'; // Should not succeed
      } catch (uniqueErr: any) {
        // Code 23505 is PostgreSQL unique_violation
        if (uniqueErr?.code === '23505' || uniqueErr?.message?.includes('duplicate key')) {
          results.uniqueConstraint = 'PASS';
        }
      }
    }

    // 5. Test Foreign Key (blogs.author_id -> users.id)
    if (userId) {
      const blogInsertRes = await client.query(
        `INSERT INTO blogs (title, slug, excerpt, content, author_id, published) 
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id;`,
        ['Test Blog Title', `test-blog-slug-${testId}`, 'Test excerpt', 'Test content', userId, false]
      );
      if (blogInsertRes.rows.length === 1) {
        blogId = blogInsertRes.rows[0].id;
        results.foreignKey = 'PASS';
      }
    }

    // 6. Test DELETE (clean up created records)
    if (blogId) {
      await client.query('DELETE FROM blogs WHERE id = $1;', [blogId]);
      blogId = null;
    }
    if (userId) {
      const deleteRes = await client.query('DELETE FROM users WHERE id = $1 RETURNING id;', [userId]);
      if (deleteRes.rows.length === 1) {
        results.delete = 'PASS';
        userId = null;
      }
    }
  } catch (err) {
    logger.error('Error during CRUD operations verification:', err);
  } finally {
    // Guaranteed cleanup
    if (blogId) {
      try {
        await client.query('DELETE FROM blogs WHERE id = $1;', [blogId]);
      } catch {}
    }
    if (userId) {
      try {
        await client.query('DELETE FROM users WHERE id = $1;', [userId]);
      } catch {}
    }
  }

  return results;
}
