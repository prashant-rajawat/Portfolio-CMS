import { Request, Response } from 'express';
import { config } from '../config/index.ts';
import { DatabaseService } from '../services/db.service.ts';
import { getDbPool } from '../db/index.ts';
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

  /**
   * GET /api/health/content
   * Returns record counts for all CMS content tables.
   */
  public static async getContentHealth(_req: Request, res: Response): Promise<void> {
    const pool = getDbPool();
    if (!pool) {
      res.status(503).json({
        success: false,
        message: 'Database not available',
        data: { about: 0, skills: 0, projects: 0, services: 0, experience: 0, testimonials: 0, blogs: 0 },
      });
      return;
    }

    try {
      const [aboutRes, skillsRes, projectsRes, servicesRes, experienceRes, testimonialsRes, blogsRes] = await Promise.all([
        pool.query('SELECT COUNT(*) FROM about;').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM skills;').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM projects;').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM services;').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM experience;').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM testimonials;').catch(() => ({ rows: [{ count: '0' }] })),
        pool.query('SELECT COUNT(*) FROM blogs;').catch(() => ({ rows: [{ count: '0' }] })),
      ]);

      const counts = {
        about: parseInt(aboutRes.rows[0]?.count || '0', 10),
        skills: parseInt(skillsRes.rows[0]?.count || '0', 10),
        projects: parseInt(projectsRes.rows[0]?.count || '0', 10),
        services: parseInt(servicesRes.rows[0]?.count || '0', 10),
        experience: parseInt(experienceRes.rows[0]?.count || '0', 10),
        testimonials: parseInt(testimonialsRes.rows[0]?.count || '0', 10),
        blogs: parseInt(blogsRes.rows[0]?.count || '0', 10),
      };

      sendSuccess(res, 'Database content counts fetched successfully', counts, 200);
    } catch (err: any) {
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to fetch content counts',
        data: { about: 0, skills: 0, projects: 0, services: 0, experience: 0, testimonials: 0, blogs: 0 },
      });
    }
  }
}
