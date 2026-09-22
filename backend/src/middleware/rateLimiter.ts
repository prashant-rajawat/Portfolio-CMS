import rateLimit from 'express-rate-limit';
import { sendError } from '../utils/response.ts';

/**
 * Targeted rate limiter for authentication endpoints (login) to prevent brute-force attacks.
 * Configured with 10 attempts per 15-minute window per IP.
 */
export const loginRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login attempts per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => {
    sendError(res, 'Too many login attempts. Please try again after 15 minutes.', 429);
  },
  skip: () => process.env.NODE_ENV === 'test', // Skip rate limiting during automated test runs
});
