import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller.ts';
import { validateRequest } from '../middleware/validator.ts';
import { loginSchema, refreshSchema } from '../validators/auth.validator.ts';
import { loginRateLimiter } from '../middleware/rateLimiter.ts';
import { authenticateToken } from '../middleware/authenticateToken.ts';

const router = Router();

/**
 * POST /api/auth/login
 * Authenticates admin credentials with rate limiting and Zod validation.
 */
router.post(
  '/login',
  loginRateLimiter,
  validateRequest({ body: loginSchema }),
  AuthController.login
);

/**
 * POST /api/auth/refresh
 * Validates and rotates refresh token to issue new access token.
 */
router.post(
  '/refresh',
  validateRequest({ body: refreshSchema }),
  AuthController.refresh
);

/**
 * GET /api/auth/me
 * Protected testing & verification endpoint to verify authenticateToken middleware.
 * Clearly marked for development/testing verification.
 */
router.get(
  '/me',
  authenticateToken,
  AuthController.me
);

export default router;
