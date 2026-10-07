import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';
import { sendError } from '../utils/response.ts';
import { config } from '../config/index.ts';

export class AppError extends Error {
  public statusCode: number;
  public isOperational: boolean;

  constructor(message: string, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  // Database connection or authentication failures
  const isDbError =
    err.message &&
    (err.message.includes('password authentication failed') ||
      err.message.includes('ECONNREFUSED') ||
      err.message.includes('ETIMEDOUT') ||
      err.message.includes('connection timeout') ||
      err.message.includes('Database service is unavailable'));

  if (isDbError) {
    logger.debug(`Database service unavailable during ${req.method} ${req.originalUrl}`);
    sendError(res, 'Database service is currently unavailable. Please verify database connection configuration.', 503);
    return;
  }

  logger.error(`Error occurred during ${req.method} ${req.originalUrl}:`, err);

  // Syntax error from body-parser (e.g. malformed JSON)
  if ('type' in err && err.type === 'entity.parse.failed') {
    sendError(res, 'Malformed JSON payload in request body', 400);
    return;
  }

  // Request entity too large
  if ('type' in err && err.type === 'entity.too.large') {
    sendError(res, 'Request body size exceeds the allowed limit', 413);
    return;
  }

  // Multer errors (file size limit, field errors)
  if ('code' in err && (err.name === 'MulterError' || (err as any).code === 'LIMIT_FILE_SIZE')) {
    if ((err as any).code === 'LIMIT_FILE_SIZE') {
      sendError(res, 'File size exceeds the 5 MB maximum limit.', 400);
      return;
    }
    sendError(res, `Upload error: ${err.message}`, 400);
    return;
  }

  // Operational AppError
  if (err instanceof AppError) {
    sendError(res, err.message, err.statusCode);
    return;
  }

  // CORS policy rejection
  if (err.message && err.message.includes('CORS policy')) {
    sendError(res, 'Cross-Origin Request Blocked by Security Policy', 403);
    return;
  }

  // Default server error
  const statusCode = 500;
  const safeMessage = config.isProduction
    ? 'Internal server error. Please try again later.'
    : err.message || 'Something went wrong';

  sendError(res, safeMessage, statusCode);
}
