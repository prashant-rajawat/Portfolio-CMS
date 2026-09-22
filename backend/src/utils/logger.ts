const SENSITIVE_KEYS = [
  'password',
  'password_hash',
  'token',
  'jwt',
  'secret',
  'authorization',
  'bearer',
  'cookie',
  'apikey',
  'api_key',
  'database_url',
  'publishable_key',
];

/**
 * Recursively sanitizes data to prevent logging of sensitive credentials,
 * passwords, JWT tokens, API keys, cookies, or authorization headers.
 */
function sanitizeData(data: unknown): unknown {
  if (data === null || data === undefined) return data;
  if (typeof data === 'string') {
    // Check if looks like a connection string with password
    if (data.includes('postgres://') || data.includes('postgresql://')) {
      return '[REDACTED_DATABASE_URL]';
    }
    return data;
  }
  if (Array.isArray(data)) {
    return data.map(sanitizeData);
  }
  if (typeof data === 'object') {
    const sanitized: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (SENSITIVE_KEYS.some((s) => lowerKey.includes(s))) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = sanitizeData(value);
      }
    }
    return sanitized;
  }
  return data;
}

export const logger = {
  info(message: string, context?: unknown) {
    const timestamp = new Date().toISOString();
    if (context !== undefined) {
      console.log(`[${timestamp}] [INFO] ${message}`, sanitizeData(context));
    } else {
      console.log(`[${timestamp}] [INFO] ${message}`);
    }
  },

  warn(message: string, context?: unknown) {
    const timestamp = new Date().toISOString();
    if (context !== undefined) {
      console.warn(`[${timestamp}] [WARN] ${message}`, sanitizeData(context));
    } else {
      console.warn(`[${timestamp}] [WARN] ${message}`);
    }
  },

  error(message: string, error?: unknown) {
    const timestamp = new Date().toISOString();
    if (error instanceof Error) {
      console.error(`[${timestamp}] [ERROR] ${message} - ${error.message}`);
      if (process.env.NODE_ENV !== 'production' && error.stack) {
        console.error(error.stack);
      }
    } else if (error !== undefined) {
      console.error(`[${timestamp}] [ERROR] ${message}`, sanitizeData(error));
    } else {
      console.error(`[${timestamp}] [ERROR] ${message}`);
    }
  },

  debug(message: string, context?: unknown) {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      if (context !== undefined) {
        console.debug(`[${timestamp}] [DEBUG] ${message}`, sanitizeData(context));
      } else {
        console.debug(`[${timestamp}] [DEBUG] ${message}`);
      }
    }
  },
};
