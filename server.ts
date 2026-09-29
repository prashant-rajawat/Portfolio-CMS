import express, { Request, Response, NextFunction } from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { app } from './backend/src/app.ts';
import { config } from './backend/src/config/index.ts';
import { logger } from './backend/src/utils/logger.ts';
import { testDatabaseConnection, closeDatabaseConnections } from './backend/src/db/index.ts';

/**
 * Safely obtain current base directory regardless of whether running
 * directly via tsx (ESM) or bundled via esbuild into dist/server.cjs (CJS).
 */
function getBaseDir(): string {
  if (typeof __dirname !== 'undefined') {
    return __dirname;
  }
  return process.cwd();
}

/**
 * Robustly discovers the absolute path to the 'dist' directory containing built frontend assets.
 * Works seamlessly across local development, root execution, and Render production environments.
 */
function resolveDistDirectory(): string {
  const baseDir = getBaseDir();
  const candidatePaths = [
    path.resolve(process.cwd(), 'dist'),
    path.resolve(baseDir),
    path.resolve(baseDir, '..', 'dist'),
    path.resolve(baseDir, 'dist'),
  ];

  for (const candidate of candidatePaths) {
    if (fs.existsSync(path.join(candidate, 'index.html'))) {
      return candidate;
    }
  }

  // Fallback to standard process.cwd()/dist
  return path.resolve(process.cwd(), 'dist');
}

async function startServer() {
  const PORT = config.port || 3000;
  const HOST = '0.0.0.0';

  const distPath = resolveDistDirectory();
  const hasBuiltFrontend = fs.existsSync(path.join(distPath, 'index.html'));
  const isProduction =
    config.nodeEnv === 'production' ||
    process.env.NODE_ENV === 'production' ||
    hasBuiltFrontend;

  // In local development without a pre-built dist folder, mount Vite middleware for live HMR & compilation
  if (!isProduction && !hasBuiltFrontend) {
    logger.info('Initializing Vite SPA development middleware...');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production (or whenever built dist assets are available), serve the compiled React SPA
    logger.info(`Serving static production client from: ${distPath}`);

    // 1. Serve static assets (JS, CSS, SVGs, images, fonts, etc.)
    app.use(
      express.static(distPath, {
        maxAge: '1d',
        index: false, // Disallow automatic directory index rendering so custom fallback controls routing
      })
    );

    // 2. Explicit root route serving index.html
    app.get('/', (_req: Request, res: Response) => {
      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(500).send('Frontend build not found. Please run npm run build.');
      }
    });

    // 3. Client-side SPA fallback for client routes (/admin, /projects, /blog, /skills, /about, etc.)
    app.get('*', (req: Request, res: Response, next: NextFunction) => {
      // Never intercept backend API routes
      if (req.path.startsWith('/api')) {
        return next();
      }

      // If a missing static file with an extension was requested, return 404 instead of returning index.html
      if (/\.[a-zA-Z0-9]+$/.test(req.path)) {
        return res.status(404).send('Asset not found');
      }

      const indexPath = path.join(distPath, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Frontend index.html not found. Please run npm run build.');
      }
    });
  }

  const server = app.listen(PORT, HOST, async () => {
    logger.info(`Portfolio CMS Server running on http://${HOST}:${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Frontend Origin Configured: ${config.frontendUrl}`);

    // Verify database connectivity safely on startup
    try {
      const dbCheck = await testDatabaseConnection();
      if (dbCheck.status === 'connected') {
        logger.info(`Database connected [${dbCheck.driver}]: ${dbCheck.message}`);
      } else if (dbCheck.status === 'not_configured') {
        logger.info(`Database status: ${dbCheck.message}`);
      } else {
        logger.warn(`Database status: ${dbCheck.message}`);
      }
    } catch (err) {
      logger.error('Unexpected error during startup database check:', err);
    }
  });

  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Gracefully stopping server...`);
    server.close(async () => {
      logger.info('HTTP server terminated.');
      await closeDatabaseConnections();
      process.exit(0);
    });

    setTimeout(() => {
      logger.error('Forceful shutdown triggered');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));
}

startServer().catch((err) => {
  logger.error('Failed to start server:', err);
  process.exit(1);
});
