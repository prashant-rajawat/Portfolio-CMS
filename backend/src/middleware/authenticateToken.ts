import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthenticationError } from '../services/auth.service.ts';
import { sendError } from '../utils/response.ts';

/**
 * Authentication middleware that validates Bearer JWT access tokens.
 * Extracts user id and role and attaches to req.user.
 */
export function authenticateToken(req: Request, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    sendError(res, 'Authentication required. Authorization header is missing.', 401);
    return;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0].toLowerCase() !== 'bearer') {
    sendError(res, 'Invalid authorization format. Expected "Bearer <token>".', 401);
    return;
  }

  const token = parts[1].trim();
  if (!token) {
    sendError(res, 'Authentication token is empty.', 401);
    return;
  }

  try {
    const payload = AuthService.verifyAccessToken(token);
    req.user = {
      id: payload.id,
      role: payload.role,
    };
    next();
  } catch (err: any) {
    if (err instanceof AuthenticationError) {
      sendError(res, err.message, err.statusCode);
      return;
    }
    sendError(res, 'Invalid or expired authentication token', 401);
  }
}
