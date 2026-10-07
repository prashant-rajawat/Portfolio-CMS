import dotenv from 'dotenv';
import { logger } from '../utils/logger.ts';

dotenv.config();

export interface AuthConfig {
  jwtAccessSecret: string;
  jwtRefreshSecret: string;
  jwtAccessExpiresIn: string;
  jwtRefreshExpiresIn: string;
  bcryptSaltRounds: number;
  adminBootstrapEmail?: string;
  adminBootstrapPasswordHash?: string;
}

function getValidatedAuthConfig(): AuthConfig {
  const isProduction = process.env.NODE_ENV === 'production';
  const accessSecret = process.env.JWT_ACCESS_SECRET?.trim();
  const refreshSecret = process.env.JWT_REFRESH_SECRET?.trim();

  if (isProduction) {
    if (!accessSecret || accessSecret.length < 32) {
      throw new Error(
        'Invalid authentication configuration: JWT_ACCESS_SECRET must be set and at least 32 characters in production.'
      );
    }
    if (!refreshSecret || refreshSecret.length < 32) {
      throw new Error(
        'Invalid authentication configuration: JWT_REFRESH_SECRET must be set and at least 32 characters in production.'
      );
    }
    if (accessSecret === refreshSecret) {
      throw new Error(
        'Invalid authentication configuration: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be distinct secrets.'
      );
    }
  } else {
    if (!accessSecret || !refreshSecret) {
      logger.warn(
        'JWT secrets are not defined in .env. Using fallback development secrets. Set JWT_ACCESS_SECRET and JWT_REFRESH_SECRET for custom keys.'
      );
    }
  }

  return {
    jwtAccessSecret: accessSecret || 'dev-access-secret-portfolio-cms-change-me-in-production-min32',
    jwtRefreshSecret: refreshSecret || 'dev-refresh-secret-portfolio-cms-change-me-in-production-min32',
    jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN || '15m',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
    bcryptSaltRounds: 10,
    get adminBootstrapEmail(): string | undefined {
      return process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || undefined;
    },
    get adminBootstrapPasswordHash(): string | undefined {
      return process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim() || undefined;
    },
  };
}

export const authConfig = getValidatedAuthConfig();
