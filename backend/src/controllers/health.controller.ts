import { Request, Response } from 'express';
import { config } from '../config/index.ts';
import { DatabaseService } from '../services/db.service.ts';
import { sendSuccess } from '../utils/response.ts';

export class HealthController {
  /**
   * GET /api/health
   * Returns system health status and database connectivity status.
   */
  public static async getHealth(_req: Request, res: Response): Promise<void> {
    const dbHealth = await DatabaseService.checkHealth();

    const payload = {
      environment: config.nodeEnv,
      timestamp: new Date().toISOString(),
      database: {
        status: dbHealth.status,
        message: dbHealth.message,
        driver: dbHealth.driver,
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
      },
    };

    sendSuccess(res, 'Portfolio CMS API is running', payload, 200);
  }

  /**
   * GET /api/health/db
   * Detailed database connectivity test endpoint.
   */
  public static async getDbHealth(_req: Request, res: Response): Promise<void> {
    const dbHealth = await DatabaseService.checkHealth();

    const statusCode = dbHealth.status === 'disconnected' ? 503 : 200;
    const isSuccess = dbHealth.status !== 'disconnected';

    res.status(statusCode).json({
      success: isSuccess,
      message: dbHealth.status === 'connected'
        ? 'Database connection is healthy and responsive'
        : dbHealth.status === 'not_configured'
        ? 'Database is not yet configured'
        : 'Database connection failed',
      database: {
        status: dbHealth.status,
        driver: dbHealth.driver,
        message: dbHealth.message,
        ...(dbHealth.latencyMs !== undefined ? { latencyMs: dbHealth.latencyMs } : {}),
        testedAt: dbHealth.testedAt,
        ...(dbHealth.diagnostics ? { diagnostics: dbHealth.diagnostics } : {}),
      },
    });
  }
}
