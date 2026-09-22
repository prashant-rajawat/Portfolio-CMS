import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { app } from './backend/src/app.ts';
import { config } from './backend/src/config/index.ts';
import { logger } from './backend/src/utils/logger.ts';
import { testDatabaseConnection, closeDatabaseConnections } from './backend/src/db/index.ts';

async function startServer() {
  const PORT = config.port || 3000;
  const HOST = '0.0.0.0';

  // In development, mount Vite middleware to serve client assets if needed
  if (config.nodeEnv !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // In production, serve built frontend assets if present
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
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
