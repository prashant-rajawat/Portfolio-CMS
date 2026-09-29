import dotenv from 'dotenv';

dotenv.config();

/**
 * Sanitizes and strips whitespace or accidental wrapping quotes from environment values.
 */
function cleanEnvString(val: string | undefined, defaultValue: string = ''): string {
  if (!val) return defaultValue;
  return val.trim().replace(/^["']|["']$/g, '').trim();
}

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  corsOrigin: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  bodyLimit: string;
  isProduction: boolean;
}

const nodeEnv = cleanEnvString(process.env.NODE_ENV, 'development');
const isProduction = nodeEnv === 'production';

// In production on Render, default to the official deployed URL if FRONTEND_URL is unset
const defaultProductionUrl = 'https://portfolio-cms-kmcy.onrender.com';
const resolvedFrontendUrl = cleanEnvString(
  process.env.FRONTEND_URL || process.env.RENDER_EXTERNAL_URL || process.env.APP_URL,
  isProduction ? defaultProductionUrl : 'http://localhost:3000'
);

export const config: ServerConfig = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv,
  frontendUrl: resolvedFrontendUrl,
  corsOrigin: cleanEnvString(process.env.CORS_ORIGIN, ''),
  databaseUrl: cleanEnvString(process.env.DATABASE_URL, ''),
  supabaseUrl: cleanEnvString(process.env.SUPABASE_URL, ''),
  supabasePublishableKey: cleanEnvString(process.env.SUPABASE_PUBLISHABLE_KEY, ''),
  supabaseServiceRoleKey: cleanEnvString(process.env.SUPABASE_SERVICE_ROLE_KEY, ''),
  supabaseStorageBucket: cleanEnvString(process.env.SUPABASE_STORAGE_BUCKET, 'portfolio-media'),
  bodyLimit: '1mb',
  isProduction,
};

/**
 * Returns allowed origins for CORS.
 * In production, strictly allows configured Render domains, custom frontend URLs, and local development origins.
 */
export function getAllowedCorsOrigins(): string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  const prod = (process.env.NODE_ENV === 'production') || config.isProduction;
  if (!prod) {
    // In development, allow localhost, local dev origin, and any incoming browser origin safely
    return (origin, callback) => {
      if (!origin) return callback(null, true);
      return callback(null, true);
    };
  }

  // In production, strictly validate origin
  const allowedOrigins: string[] = [
    'https://portfolio-cms-kmcy.onrender.com',
  ];

  const fUrl = cleanEnvString(process.env.FRONTEND_URL || config.frontendUrl);
  if (fUrl) {
    const cleanUrl = fUrl.replace(/\/$/, '');
    if (!allowedOrigins.includes(cleanUrl)) {
      allowedOrigins.push(cleanUrl);
    }
  }

  const renderUrl = cleanEnvString(process.env.RENDER_EXTERNAL_URL);
  if (renderUrl) {
    const cleanUrl = renderUrl.replace(/\/$/, '');
    if (!allowedOrigins.includes(cleanUrl)) {
      allowedOrigins.push(cleanUrl);
    }
  }

  const appUrl = cleanEnvString(process.env.APP_URL);
  if (appUrl) {
    const cleanUrl = appUrl.replace(/\/$/, '');
    if (!allowedOrigins.includes(cleanUrl)) {
      allowedOrigins.push(cleanUrl);
    }
  }

  const corsEnv = cleanEnvString(process.env.CORS_ORIGIN || config.corsOrigin);
  if (corsEnv) {
    corsEnv.split(',').forEach((orig) => {
      const trimmed = cleanEnvString(orig).replace(/\/$/, '');
      if (trimmed && !allowedOrigins.includes(trimmed)) {
        allowedOrigins.push(trimmed);
      }
    });
  }

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.trim().replace(/\/$/, '');
    if (
      allowedOrigins.includes(normalized) ||
      normalized.endsWith('.onrender.com') ||
      normalized.endsWith('.run.app') ||
      normalized.includes('localhost') ||
      normalized.includes('127.0.0.1')
    ) {
      return callback(null, true);
    }
    return callback(new Error(`Blocked by CORS policy: Origin ${origin} not allowed`));
  };
}
