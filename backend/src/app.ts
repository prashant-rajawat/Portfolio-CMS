import express, { Express, Request, Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { config, getAllowedCorsOrigins } from './config/index.ts';
import { requestLogger } from './middleware/requestLogger.ts';
import { errorHandler } from './middleware/errorHandler.ts';
import apiRouter from './routes/index.ts';
import { sendError } from './utils/response.ts';

export function createApp(): Express {
  const app = express();

  // 0. Enable Trust Proxy for reverse proxies (Render, Cloud Run, Heroku)
  app.set('trust proxy', 1);

  // 1. Basic Security Headers with Helmet
  app.use(
    helmet({
      contentSecurityPolicy: false, // Allows flexible integration with Vite frontend in unified preview
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // 2. CORS Configuration
  app.use(
    cors({
      origin: getAllowedCorsOrigins(),
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
    })
  );

  // 3. Request Body Limits (Reasonable limit to avoid unlimited payload attacks)
  app.use(express.json({ limit: config.bodyLimit }));
  app.use(express.urlencoded({ extended: true, limit: config.bodyLimit }));

  // 4. Request Logging (Clean, sanitized logs)
  app.use(requestLogger);

  // 5. Mount API Routes
  app.use('/api', apiRouter);

  // 6. Handle 404 for undefined API routes
  app.use('/api/*', (req: Request, res: Response) => {
    sendError(res, `API route not found: ${req.method} ${req.originalUrl}`, 404);
  });

  // 7. Centralized Error Handler
  app.use(errorHandler);

  return app;
}

export const app = createApp();
