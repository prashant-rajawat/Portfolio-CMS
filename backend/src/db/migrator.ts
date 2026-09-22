import fs from 'fs';
import path from 'path';
import { getDbPool } from './index.ts';
import { logger } from '../utils/logger.ts';
import { config } from '../config/index.ts';

export interface MigrationResult {
  success: boolean;
  totalMigrations: number;
  appliedCount: number;
  appliedMigrations: string[];
  skippedCount: number;
  message: string;
  error?: string;
}

/**
 * Executes database migrations in sequential order.
 * Ensures idempotent execution via schema_migrations tracking table.
 * Never prints connection strings or passwords.
 */
export async function runMigrations(): Promise<MigrationResult> {
  if (!config.databaseUrl) {
    const msg = 'DATABASE_URL is not configured. Please define DATABASE_URL in your .env file to run migrations.';
    logger.warn(msg);
    return {
      success: false,
      totalMigrations: 0,
      appliedCount: 0,
      appliedMigrations: [],
      skippedCount: 0,
      message: msg,
    };
  }

  const pool = getDbPool();
  if (!pool) {
    const msg = 'Failed to obtain PostgreSQL connection pool.';
    logger.error(msg);
    return {
      success: false,
      totalMigrations: 0,
      appliedCount: 0,
      appliedMigrations: [],
      skippedCount: 0,
      message: msg,
    };
  }

  // Resolve migrations directory
  const migrationsDir = path.resolve(process.cwd(), 'backend', 'migrations');
  if (!fs.existsSync(migrationsDir)) {
    const msg = `Migrations directory not found at: ${migrationsDir}`;
    logger.error(msg);
    return {
      success: false,
      totalMigrations: 0,
      appliedCount: 0,
      appliedMigrations: [],
      skippedCount: 0,
      message: msg,
    };
  }

  const migrationFiles = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  let client;
  try {
    client = await pool.connect();

    // 1. Ensure migrations tracking table exists
    await client.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        id SERIAL PRIMARY KEY,
        migration_name VARCHAR(255) UNIQUE NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Fetch already applied migrations
    const appliedResult = await client.query('SELECT migration_name FROM schema_migrations;');
    const appliedSet = new Set(appliedResult.rows.map((row: { migration_name: string }) => row.migration_name));

    const newlyApplied: string[] = [];
    let skippedCount = 0;

    logger.info(`Starting migration run. Found ${migrationFiles.length} migration files.`);

    // 3. Process each migration in transaction
    for (const file of migrationFiles) {
      if (appliedSet.has(file)) {
        logger.debug(`Skipping already applied migration: ${file}`);
        skippedCount++;
        continue;
      }

      const filePath = path.join(migrationsDir, file);
      const sqlContent = fs.readFileSync(filePath, 'utf-8');

      logger.info(`Applying migration: ${file}...`);

      try {
        await client.query('BEGIN');
        await client.query(sqlContent);
        await client.query('INSERT INTO schema_migrations (migration_name) VALUES ($1)', [file]);
        await client.query('COMMIT');
        newlyApplied.push(file);
        logger.info(`✓ Successfully applied migration: ${file}`);
      } catch (migrationErr) {
        await client.query('ROLLBACK');
        const errMessage = migrationErr instanceof Error ? migrationErr.message : String(migrationErr);
        logger.error(`✗ Migration failed on ${file}: ${errMessage}`);
        return {
          success: false,
          totalMigrations: migrationFiles.length,
          appliedCount: newlyApplied.length,
          appliedMigrations: newlyApplied,
          skippedCount,
          message: `Migration failed on ${file}`,
          error: errMessage,
        };
      }
    }

    const message =
      newlyApplied.length > 0
        ? `Applied ${newlyApplied.length} migration(s). ${skippedCount} already up-to-date.`
        : `Database schema is already up to date. (${skippedCount} migrations verified).`;

    logger.info(message);

    return {
      success: true,
      totalMigrations: migrationFiles.length,
      appliedCount: newlyApplied.length,
      appliedMigrations: newlyApplied,
      skippedCount,
      message,
    };
  } catch (connErr) {
    const errMessage = connErr instanceof Error ? connErr.message : String(connErr);
    logger.error('Database connection error during migration execution:', errMessage);
    return {
      success: false,
      totalMigrations: migrationFiles.length,
      appliedCount: 0,
      appliedMigrations: [],
      skippedCount: 0,
      message: 'Failed to connect to PostgreSQL database.',
      error: errMessage,
    };
  } finally {
    if (client) {
      client.release();
    }
  }
}
