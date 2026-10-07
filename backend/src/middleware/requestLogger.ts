import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const { method, originalUrl, ip } = req;

  // Skip noisy development module and Vite asset requests
  if (
    originalUrl.startsWith('/@') ||
    originalUrl.startsWith('/src/') ||
    originalUrl.startsWith('/node_modules/') ||
    originalUrl.endsWith('.tsx') ||
    originalUrl.endsWith('.ts') ||
    originalUrl.endsWith('.css') ||
    originalUrl.endsWith('.map') ||
    originalUrl.endsWith('.ico')
  ) {
    return next();
  }

  const start = Date.now();

  // Log incoming request
  logger.info(`Request received: ${method} ${originalUrl} from ${ip || 'unknown'}`);

  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    if (statusCode >= 500 && statusCode !== 503) {
      logger.error(`Response sent: ${method} ${originalUrl} ${statusCode} (${duration}ms)`);
    } else if (statusCode >= 400 || statusCode === 503) {
      logger.warn(`Response sent: ${method} ${originalUrl} ${statusCode} (${duration}ms)`);
    } else {
      logger.info(`Response sent: ${method} ${originalUrl} ${statusCode} (${duration}ms)`);
    }
  });

  next();
}
