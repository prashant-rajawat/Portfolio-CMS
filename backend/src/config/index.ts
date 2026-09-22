import dotenv from 'dotenv';

dotenv.config();

export interface ServerConfig {
  port: number;
  nodeEnv: string;
  frontendUrl: string;
  databaseUrl: string;
  supabaseUrl: string;
  supabasePublishableKey: string;
  supabaseServiceRoleKey: string;
  supabaseStorageBucket: string;
  bodyLimit: string;
  isProduction: boolean;
}

const nodeEnv = process.env.NODE_ENV || 'development';
const isProduction = nodeEnv === 'production';

export const config: ServerConfig = {
  port: Number(process.env.PORT) || 3000,
  nodeEnv,
  frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
  databaseUrl: process.env.DATABASE_URL || '',
  supabaseUrl: process.env.SUPABASE_URL || '',
  supabasePublishableKey: process.env.SUPABASE_PUBLISHABLE_KEY || '',
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
  supabaseStorageBucket: process.env.SUPABASE_STORAGE_BUCKET || 'portfolio-media',
  bodyLimit: '1mb',
  isProduction,
};

/**
 * Returns allowed origins for CORS.
 * In production, wildcards '*' are disallowed and origins must match the configured frontend URL.
 */
export function getAllowedCorsOrigins(): string[] | ((origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => void) {
  if (!isProduction) {
    // In development, allow localhost, local dev origin, and any incoming browser origin safely
    return (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);
      return callback(null, true);
    };
  }

  // In production, strictly validate origin
  const allowedOrigins: string[] = [];
  if (config.frontendUrl) {
    allowedOrigins.push(config.frontendUrl.trim().replace(/\/$/, ''));
  }
  if (process.env.APP_URL) {
    allowedOrigins.push(process.env.APP_URL.trim().replace(/\/$/, ''));
  }

  return (origin, callback) => {
    if (!origin) return callback(null, true);
    const normalized = origin.trim().replace(/\/$/, '');
    if (allowedOrigins.includes(normalized)) {
      return callback(null, true);
    }
    return callback(new Error('Blocked by CORS policy: Origin not allowed'));
  };
}
