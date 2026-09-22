import { Request, Response, NextFunction } from 'express';
import { AuthService, AuthenticationError } from '../services/auth.service.ts';
import { sendSuccess, sendError } from '../utils/response.ts';

export class AuthController {
  /**
   * POST /api/auth/login
   * Authenticates admin with email and password.
   */
  public static async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;
      const result = await AuthService.login(email, password);

      sendSuccess(res, 'Login successful', result, 200);
    } catch (err: any) {
      if (err instanceof AuthenticationError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }

  /**
   * POST /api/auth/refresh
   * Exchanges a valid refresh token for a new access and refresh token pair.
   */
  public static async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshAccessToken(refreshToken);

      sendSuccess(res, 'Token refreshed successfully', result, 200);
    } catch (err: any) {
      if (err instanceof AuthenticationError) {
        sendError(res, err.message, err.statusCode);
        return;
      }
      next(err);
    }
  }

  /**
   * GET /api/auth/me
   * Development & verification helper route to inspect authenticated user info.
   * Marked strictly for verification and testing.
   */
  public static async me(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        sendError(res, 'Unauthenticated', 401);
        return;
      }

      const userRecord = await AuthService.findUserById(req.user.id);
      if (!userRecord) {
        // Fallback for mock/test sessions
        sendSuccess(res, 'Authenticated user context (dev session)', {
          id: req.user.id,
          role: req.user.role,
        });
        return;
      }

      sendSuccess(res, 'Current authenticated user profile', AuthService.sanitizeUser(userRecord));
    } catch (err: any) {
      next(err);
    }
  }
}
