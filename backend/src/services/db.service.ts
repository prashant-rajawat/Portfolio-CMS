import { testDatabaseConnection, DbHealthResult, getDbPool, getSupabaseClient } from '../db/index.ts';

export class DatabaseService {
  /**
   * Performs safe health check on database connection.
   */
  public static async checkHealth(): Promise<DbHealthResult> {
    return await testDatabaseConnection();
  }

  /**
   * Retrieves raw SQL query runner for future steps (when migrations and tables are set).
   */
  public static getPool() {
    return getDbPool();
  }

  /**
   * Retrieves Supabase client instance.
   */
  public static getSupabase() {
    return getSupabaseClient();
  }
}
