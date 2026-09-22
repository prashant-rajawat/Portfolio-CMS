import http from 'http';
import { app } from './app.ts';
import { config } from './config/index.ts';
import { logger } from './utils/logger.ts';
import { testDatabaseConnection, closeDatabaseConnections } from './db/index.ts';

export async function startBackendServer(): Promise<http.Server> {
  const PORT = config.port;
  const HOST = '0.0.0.0';

  const server = http.createServer(app);

  server.listen(PORT, HOST, async () => {
    logger.info(`Portfolio CMS Server started on http://${HOST}:${PORT}`);
    logger.info(`Environment: ${config.nodeEnv}`);
    logger.info(`Frontend URL configured: ${config.frontendUrl}`);

    // Verify database connection asynchronously on startup
    try {
      const dbCheck = await testDatabaseConnection();
      if (dbCheck.status === 'connected') {
        logger.info(`Database connected [${dbCheck.driver}]: ${dbCheck.message}`);
      } else if (dbCheck.status === 'not_configured') {
        logger.info(`Database note: ${dbCheck.message}`);
      } else {
        logger.warn(`Database connection warning: ${dbCheck.message}`);
      }
    } catch (err) {
      logger.error('Unexpected error during startup database check:', err);
    }
  });

  // Graceful shutdown handling
  const shutdown = async (signal: string) => {
    logger.info(`Received ${signal}. Shutting down gracefully...`);
    server.close(async () => {
      logger.info('HTTP server closed.');
      await closeDatabaseConnections();
      process.exit(0);
    });

    // Force shutdown if taking too long
    setTimeout(() => {
      logger.error('Forceful shutdown after timeout');
      process.exit(1);
    }, 10000);
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}

// Auto-run if executed directly via tsx
if (process.argv[1]?.endsWith('server.ts') || process.argv[1]?.endsWith('server.js')) {
  startBackendServer();
}
