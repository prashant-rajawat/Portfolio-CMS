import pg from 'pg';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.ts';
import { logger } from '../utils/logger.ts';

const { Pool } = pg;

let realPool: pg.Pool | null = null;
let activeConnectionString: string | null = null;
let isCustomPool = false;
let supabaseClient: SupabaseClient | null = null;

/**
 * Sanitizes and normalizes the PostgreSQL connection string.
 * Strips accidental wrapping quotes, leading/trailing whitespace, and validates basic scheme.
 */
export function sanitizeConnectionString(url: string): string {
  let cleaned = (url || '').trim().replace(/^["']|["']$/g, '').trim();
  if (cleaned.startsWith('postgres://')) {
    cleaned = 'postgresql://' + cleaned.slice('postgres://'.length);
  }
  return cleaned;
}

export interface SafeDbDiagnostic {
  hasDatabaseUrl: boolean;
  host?: string;
  port?: string;
  database?: string;
  sslEnabled?: boolean;
  poolInitialized: boolean;
}

/**
 * Returns safe diagnostic information about the database configuration.
 * Never exposes credentials, passwords, or full connection strings.
 */
export function getSafeDbDiagnostics(): SafeDbDiagnostic {
  const rawUrl = (process.env.DATABASE_URL || config.databaseUrl || '').trim();
  if (!rawUrl) {
    return {
      hasDatabaseUrl: false,
      poolInitialized: realPool !== null,
    };
  }

  try {
    const cleaned = sanitizeConnectionString(rawUrl);
    const parsed = new URL(cleaned);
    const isLocalhost = cleaned.includes('localhost') || cleaned.includes('127.0.0.1');
    return {
      hasDatabaseUrl: true,
      host: parsed.hostname || undefined,
      port: parsed.port || '5432',
      database: parsed.pathname ? parsed.pathname.replace(/^\//, '') : undefined,
      sslEnabled: !isLocalhost,
      poolInitialized: realPool !== null,
    };
  } catch {
    return {
      hasDatabaseUrl: true,
      poolInitialized: realPool !== null,
    };
  }
}

/**
 * Initializes and returns the primary PostgreSQL connection pool.
 * Evaluates DATABASE_URL dynamically so changes take effect without stale pool caching.
 */
export function getDbPool(): pg.Pool | null {
  if (isCustomPool && realPool) {
    return realPool;
  }

  const rawUrl = (process.env.DATABASE_URL || config.databaseUrl || '').trim();
  if (!rawUrl) {
    if (realPool && !isCustomPool) {
      realPool.end().catch(() => {});
      realPool = null;
      activeConnectionString = null;
    }
    return realPool;
  }

  const connectionString = sanitizeConnectionString(rawUrl);

  // If pool is already active with the exact same connection string, reuse it
  if (realPool && !isCustomPool && activeConnectionString === connectionString) {
    return realPool;
  }

  // If connection string has changed, close old pool and recreate
  if (realPool && !isCustomPool) {
    realPool.end().catch(() => {});
    realPool = null;
    activeConnectionString = null;
  }

  const isLocalhost = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const sslConfig = isLocalhost ? false : { rejectUnauthorized: false };

  try {
    realPool = new Pool({
      connectionString,
      ssl: sslConfig,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
    activeConnectionString = connectionString;
    isCustomPool = false;

    realPool.on('error', (err) => {
      logger.debug(`PostgreSQL pool client warning: ${err.message}`);
    });

    return realPool;
  } catch (err) {
    logger.error('Failed to instantiate PostgreSQL Pool:', err);
    return null;
  }
}

/**
 * Sets or overrides the database connection pool (used for testing).
 */
export function setDbPool(customPool: pg.Pool | null): void {
  if (customPool) {
    realPool = customPool;
    isCustomPool = true;
    activeConnectionString = null;
  } else {
    realPool = null;
    isCustomPool = false;
    activeConnectionString = null;
  }
}

/**
 * Returns the initialized Supabase JavaScript Client if SUPABASE_URL and key are provided.
 */
export function getSupabaseClient(): SupabaseClient | null {
  const sbUrl = (config.supabaseUrl || '').trim().replace(/^["']|["']$/g, '').trim();
  const sbKey = (config.supabasePublishableKey || '').trim().replace(/^["']|["']$/g, '').trim();

  if (!sbUrl || !sbKey) {
    return null;
  }

  if (!supabaseClient) {
    try {
      supabaseClient = createClient(sbUrl, sbKey, {
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
  diagnostics?: SafeDbDiagnostic;
}

/**
 * Safe database connection test.
 * Runs a simple query (SELECT 1) with timeout against the real PostgreSQL pool.
 * Never exposes credentials, passwords, or connection strings.
 */
export async function testDatabaseConnection(): Promise<DbHealthResult> {
  const testedAt = new Date().toISOString();
  const diagnostics = getSafeDbDiagnostics();
  const pool = getDbPool();

  if (pool) {
    const start = Date.now();
    let client: pg.PoolClient | null = null;
    try {
      client = await pool.connect();
      await client.query('SELECT 1 AS alive;');
      const latencyMs = Date.now() - start;
      logger.info(`PostgreSQL database connected successfully via pool (${latencyMs}ms)`);
      return {
        status: 'connected',
        driver: 'pg',
        message: 'PostgreSQL database connection verified and responsive',
        latencyMs,
        testedAt,
        diagnostics,
      };
    } catch (err: any) {
      const latencyMs = Date.now() - start;
      logger.debug(`PostgreSQL connection test failed: ${err.message}`);
      return {
        status: 'disconnected',
        driver: 'pg',
        message: 'Unable to reach PostgreSQL database',
        latencyMs,
        testedAt,
        diagnostics,
      };
    } finally {
      if (client) {
        client.release();
      }
    }
  }

  return {
    status: 'not_configured',
    driver: 'none',
    message: 'DATABASE_URL is not configured.',
    testedAt,
    diagnostics,
  };
}

/**
 * Closes all database connections gracefully.
 */
export async function closeDatabaseConnections(): Promise<void> {
  if (realPool) {
    try {
      await realPool.end();
      logger.info('PostgreSQL connection pool closed');
    } catch (err) {
      logger.error('Error closing database pool:', err);
    }
    realPool = null;
    activeConnectionString = null;
  }
}
