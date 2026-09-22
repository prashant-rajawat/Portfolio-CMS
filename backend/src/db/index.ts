import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.ts';
import { logger } from '../utils/logger.ts';

const { Pool } = pg;

let pool: pg.Pool | null = null;
let supabaseClient: SupabaseClient | null = null;

/**
 * Initializes and returns the PostgreSQL connection pool (Supabase Postgres).
 */
export function getDbPool(): pg.Pool | null {
  if (pool) {
    return pool;
  }

  if (!config.databaseUrl) {
    return null;
  }

  // Supabase requires SSL in production/cloud environments
  const isLocalhost = config.databaseUrl.includes('localhost') || config.databaseUrl.includes('127.0.0.1');
  const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

  pool = new Pool({
    connectionString: config.databaseUrl,
    ssl: sslConfig,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  pool.on('error', (err) => {
    logger.error('Unexpected error on idle PostgreSQL client:', err);
  });

  return pool;
}

/**
 * Sets or overrides the database connection pool (used for testing or custom pool configuration).
 */
export function setDbPool(customPool: pg.Pool | null): void {
  pool = customPool;
}

/**
 * Returns the initialized Supabase JavaScript Client if SUPABASE_URL and key are provided.
 */
export function getSupabaseClient(): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabasePublishableKey) {
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(config.supabaseUrl, config.supabasePublishableKey, {
        auth: {
          persistSession: false,
        },
      });
    } catch (err) {
      logger.error('Failed to initialize Supabase client:', err);
      return null;
    }
  }

  return supabaseClient;
}

export interface DbHealthResult {
  status: 'connected' | 'disconnected' | 'not_configured';
  driver: 'pg' | 'supabase-js' | 'none';
  message: string;
  latencyMs?: number;
  testedAt: string;
}

/**
 * Safe database connection test.
 * Runs a simple query (SELECT 1) with a 5-second timeout.
 * Never exposes credentials, passwords, or connection strings.
 */
export async function testDatabaseConnection(): Promise<DbHealthResult> {
  const testedAt = new Date().toISOString();
  const dbPool = getDbPool();

  if (dbPool) {
    const start = Date.now();
    let client: pg.PoolClient | null = null;
    try {
      client = await dbPool.connect();
      await client.query('SELECT 1 AS alive;');
      const latencyMs = Date.now() - start;
      logger.info(`Database connected successfully via PostgreSQL pool (${latencyMs}ms)`);
      return {
        status: 'connected',
        driver: 'pg',
        message: 'PostgreSQL database connection verified and responsive',
        latencyMs,
        testedAt,
      };
    } catch (err) {
      const latencyMs = Date.now() - start;
      logger.error('Database connection test failed:', err);
      return {
        status: 'disconnected',
        driver: 'pg',
        message: 'Unable to reach PostgreSQL database. Please check DATABASE_URL configuration.',
        latencyMs,
        testedAt,
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  // If no DATABASE_URL, check if Supabase Client is configured
  const sbClient = getSupabaseClient();
  if (sbClient) {
    return {
      status: 'connected',
      driver: 'supabase-js',
      message: 'Supabase client initialized with provided URL and key',
      testedAt,
    };
  }

  // Not configured yet
  return {
    status: 'not_configured',
    driver: 'none',
    message: 'Database credentials not configured in environment (DATABASE_URL or SUPABASE_URL)',
    testedAt,
  };
}

/**
 * Closes all database connections gracefully.
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (pool) {
    try {
      await pool.end();
      logger.info('PostgreSQL connection pool closed');
    } catch (err) {
      logger.error('Error closing database pool:', err);
    }
    pool = null;
  }
}
