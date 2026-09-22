import { Request, Response, NextFunction } from 'express';
import { sendError } from '../utils/response.ts';

/**
 * Authorization middleware that ensures the authenticated user has the 'admin' role.
 * Must be mounted after authenticateToken.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
    sendError(res, 'Authentication required before verifying permissions.', 401);
    return;
  }

  if (req.user.role !== 'admin') {
    sendError(res, 'Forbidden: Administrator privileges required to access this resource.', 403);
    return;
  }

  next();
}
