import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { authConfig } from '../config/auth.ts';
import { getDbPool } from '../db/index.ts';
import { logger } from '../utils/logger.ts';
import {
  JwtUserPayload,
  SafeUser,
  UserRecord,
  LoginResult,
} from '../types/auth.ts';

export class AuthenticationError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthenticationError';
    this.statusCode = statusCode;
  }
}

export class AuthService {
  /**
   * Hashes a plain-text password using bcrypt.
   */
  public static async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, authConfig.bcryptSaltRounds);
  }

  /**
   * Securely compares a plain-text password against a stored bcrypt hash.
   */
  public static async comparePassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a short-lived JWT access token containing minimal claims.
   */
  public static generateAccessToken(user: { id: string; role: string }): string {
    const payload: JwtUserPayload = {
      id: user.id,
      role: user.role,
      tokenType: 'access',
    };

    return jwt.sign(payload, authConfig.jwtAccessSecret, {
      expiresIn: authConfig.jwtAccessExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Generates a JWT refresh token containing minimal claims.
   */
  public static generateRefreshToken(user: { id: string; role: string }): string {
    const payload: JwtUserPayload = {
      id: user.id,
      role: user.role,
      tokenType: 'refresh',
    };

    return jwt.sign(payload, authConfig.jwtRefreshSecret, {
      expiresIn: authConfig.jwtRefreshExpiresIn as jwt.SignOptions['expiresIn'],
    });
  }

  /**
   * Verifies and decodes a JWT access token.
   */
  public static verifyAccessToken(token: string): JwtUserPayload {
    try {
      const decoded = jwt.verify(token, authConfig.jwtAccessSecret) as JwtUserPayload;
      if (decoded.tokenType !== 'access') {
        throw new AuthenticationError('Invalid token purpose. Access token required.', 401);
      }
      return decoded;
    } catch (err: any) {
      if (err instanceof AuthenticationError) {
        throw err;
      }
      if (err?.name === 'TokenExpiredError') {
        throw new AuthenticationError('Access token has expired', 401);
      }
      throw new AuthenticationError('Invalid access token', 401);
    }
  }

  /**
   * Verifies and decodes a JWT refresh token.
   */
  public static verifyRefreshToken(token: string): JwtUserPayload {
    try {
      const decoded = jwt.verify(token, authConfig.jwtRefreshSecret) as JwtUserPayload;
      if (decoded.tokenType !== 'refresh') {
        throw new AuthenticationError('Invalid token purpose. Refresh token required.', 401);
      }
      return decoded;
    } catch (err: any) {
      if (err instanceof AuthenticationError) {
        throw err;
      }
      if (err?.name === 'TokenExpiredError') {
        throw new AuthenticationError('Refresh token has expired', 401);
      }
      throw new AuthenticationError('Invalid refresh token', 401);
    }
  }

  /**
   * Computes a SHA-256 hash of a raw token for secure database persistence.
   */
  public static hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  /**
   * Finds a user by email using parameterized SQL query.
   */
  public static async findUserByEmail(email: string): Promise<UserRecord | null> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when finding user by email');
      throw new AuthenticationError('Database service is unavailable. Please verify database connection configuration.', 503);
    }

    const query = `
      SELECT id, name, email, password_hash, role, created_at, updated_at
      FROM users
      WHERE LOWER(email) = LOWER($1)
      LIMIT 1;
    `;

    const result = await pool.query(query, [email.trim()]);
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as UserRecord;
  }

  /**
   * Finds a user by id using parameterized SQL query.
   */
  public static async findUserById(id: string): Promise<UserRecord | null> {
    if (id === 'bootstrap-admin-id') {
      const bootstrapEmail = authConfig.adminBootstrapEmail || process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || 'admin@portfolio.local';
      return {
        id: 'bootstrap-admin-id',
        name: 'Bootstrap Administrator',
        email: bootstrapEmail,
        password_hash: '',
        role: 'admin',
        created_at: new Date(),
        updated_at: new Date(),
      };
    }

    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when finding user by id');
      return null;
    }

    const query = `
      SELECT id, name, email, password_hash, role, created_at, updated_at
      FROM users
      WHERE id = $1
      LIMIT 1;
    `;

    try {
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) {
        return null;
      }

      return result.rows[0] as UserRecord;
    } catch {
      return null;
    }
  }

  /**
   * Strips sensitive fields (password_hash) from a user record.
   */
  public static sanitizeUser(user: UserRecord): SafeUser {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  }

  /**
   * Authenticates user with email and password.
   * Prioritizes PostgreSQL database authentication.
   * If PostgreSQL is unavailable/fails to connect, uses secure environment bootstrap admin if configured.
   */
  public static async login(email: string, password: string): Promise<LoginResult> {
    const GENERIC_LOGIN_ERROR = 'Invalid email or password';
    let user: UserRecord | null = null;
    let databaseFailure = false;

    // 1. Attempt standard PostgreSQL database authentication
    try {
      user = await this.findUserByEmail(email);
    } catch {
      databaseFailure = true;
    }

    // 2. If PostgreSQL database query succeeded, perform normal authentication
    if (!databaseFailure) {
      if (!user) {
        // Run dummy compare to mitigate timing attacks
        await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxy01234567890123456789012345678');
        throw new AuthenticationError(GENERIC_LOGIN_ERROR, 401);
      }

      const passwordValid = await this.comparePassword(password, user.password_hash);
      if (!passwordValid) {
        throw new AuthenticationError(GENERIC_LOGIN_ERROR, 401);
      }

      // Generate tokens
      const accessToken = this.generateAccessToken({ id: user.id, role: user.role });
      const refreshToken = this.generateRefreshToken({ id: user.id, role: user.role });

      // Store refresh token hash in database if pool is available
      await this.persistRefreshToken(user.id, refreshToken);

      logger.info(`Successful login for user ID: ${user.id} (${user.role})`);

      return {
        accessToken,
        refreshToken,
        user: this.sanitizeUser(user),
      };
    }

    // 3. Emergency Bootstrap Admin Path (only when PostgreSQL is unreachable or connection fails)
    const bootstrapEmail = authConfig.adminBootstrapEmail || process.env.ADMIN_BOOTSTRAP_EMAIL?.trim();
    const bootstrapHash = authConfig.adminBootstrapPasswordHash || process.env.ADMIN_BOOTSTRAP_PASSWORD_HASH?.trim();

    if (!bootstrapEmail || !bootstrapHash) {
      logger.warn('Database unavailable during login and no bootstrap admin configured.');
      throw new AuthenticationError('Database service is unavailable. Please verify database connection configuration.', 503);
    }

    logger.warn('Database unavailable; bootstrap admin authentication attempted.');

    const normalizedInputEmail = email.trim().toLowerCase();
    const normalizedBootstrapEmail = bootstrapEmail.toLowerCase();

    if (normalizedInputEmail !== normalizedBootstrapEmail) {
      await bcrypt.compare(password, '$2a$10$abcdefghijklmnopqrstuvwxy01234567890123456789012345678');
      throw new AuthenticationError(GENERIC_LOGIN_ERROR, 401);
    }

    const bootstrapPasswordValid = await this.comparePassword(password, bootstrapHash);
    if (!bootstrapPasswordValid) {
      throw new AuthenticationError(GENERIC_LOGIN_ERROR, 401);
    }

    const bootstrapUser: SafeUser = {
      id: 'bootstrap-admin-id',
      name: 'Bootstrap Administrator',
      email: bootstrapEmail,
      role: 'admin',
    };

    const accessToken = this.generateAccessToken({ id: bootstrapUser.id, role: bootstrapUser.role });
    const refreshToken = this.generateRefreshToken({ id: bootstrapUser.id, role: bootstrapUser.role });

    logger.info('Successful emergency bootstrap login for administrator');

    return {
      accessToken,
      refreshToken,
      user: bootstrapUser,
    };
  }

  /**
   * Refreshes an access token using a valid refresh token with token rotation.
   */
  public static async refreshAccessToken(rawRefreshToken: string): Promise<{
    accessToken: string;
    refreshToken: string;
    user: SafeUser;
  }> {
    // 1. Verify token signature and expiration
    const payload = this.verifyRefreshToken(rawRefreshToken);

    // If this is an active bootstrap admin session
    if (payload.id === 'bootstrap-admin-id') {
      const bootstrapEmail = authConfig.adminBootstrapEmail || process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() || 'admin@portfolio.local';
      const bootstrapUser: SafeUser = {
        id: 'bootstrap-admin-id',
        name: 'Bootstrap Administrator',
        email: bootstrapEmail,
        role: 'admin',
      };
      const newAccessToken = this.generateAccessToken({ id: bootstrapUser.id, role: bootstrapUser.role });
      const newRefreshToken = this.generateRefreshToken({ id: bootstrapUser.id, role: bootstrapUser.role });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        user: bootstrapUser,
      };
    }

    const pool = getDbPool();
    let userRecord: UserRecord | null = null;

    if (pool) {
      try {
        const tokenHash = this.hashToken(rawRefreshToken);

        // Check if refresh_tokens table exists
        const tableCheck = await pool.query(`
          SELECT EXISTS (
            SELECT 1 FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'refresh_tokens'
          );
        `);

        if (tableCheck.rows[0].exists) {
          // Query token record
          const tokenQuery = `
            SELECT id, user_id, expires_at, revoked_at
            FROM refresh_tokens
            WHERE token_hash = $1
            LIMIT 1;
          `;
          const tokenResult = await pool.query(tokenQuery, [tokenHash]);

          if (tokenResult.rows.length === 0) {
            throw new AuthenticationError('Invalid refresh token session', 401);
          }

          const storedToken = tokenResult.rows[0];
          if (storedToken.revoked_at) {
            throw new AuthenticationError('Refresh token has already been revoked', 401);
          }

          if (new Date(storedToken.expires_at) < new Date()) {
            throw new AuthenticationError('Refresh token has expired', 401);
          }

          // Revoke the current token (one-time use / rotation)
          await pool.query('UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1', [storedToken.id]);
        }

        userRecord = await this.findUserById(payload.id);
      } catch (err: any) {
        if (err instanceof AuthenticationError) {
          throw err;
        }
        logger.debug('Database refresh token verification skipped due to pool error');
      }
    }

    if (!userRecord) {
      if (payload.role === 'admin') {
        userRecord = {
          id: payload.id,
          name: 'Administrator',
          email: 'admin@portfolio.local',
          password_hash: '',
          role: payload.role,
          created_at: new Date(),
          updated_at: new Date(),
        };
      } else {
        throw new AuthenticationError('User account not found', 401);
      }
    }

    // Issue new token pair
    const newAccessToken = this.generateAccessToken({ id: userRecord.id, role: userRecord.role });
    const newRefreshToken = this.generateRefreshToken({ id: userRecord.id, role: userRecord.role });

    // Persist new refresh token hash if pool is active
    await this.persistRefreshToken(userRecord.id, newRefreshToken);

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
      user: this.sanitizeUser(userRecord),
    };
  }

  /**
   * Persists a hashed refresh token in the refresh_tokens table if available.
   */
  private static async persistRefreshToken(userId: string, rawToken: string): Promise<void> {
    const pool = getDbPool();
    if (!pool) return;

    try {
      const tableCheck = await pool.query(`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'refresh_tokens'
        );
      `);

      if (!tableCheck.rows[0].exists) return;

      const tokenHash = this.hashToken(rawToken);
      // Compute expiration: default 7 days from now
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

      await pool.query(
        `INSERT INTO refresh_tokens (user_id, token_hash, expires_at)
         VALUES ($1, $2, $3);`,
        [userId, tokenHash, expiresAt]
      );
    } catch (err: any) {
      logger.error('Failed to persist refresh token hash:', err?.message || err);
    }
  }

  /**
   * Creates a new admin user account.
   * Hashes password and validates email uniqueness.
   */
  public static async createAdminUser(params: {
    name: string;
    email: string;
    password: string;
    role?: string;
  }): Promise<SafeUser> {
    const pool = getDbPool();
    if (!pool) {
      throw new Error('Database pool unavailable. Configure DATABASE_URL to create admin user.');
    }

    const trimmedEmail = params.email.trim().toLowerCase();
    const role = params.role || 'admin';

    // 1. Check if user already exists
    const existing = await this.findUserByEmail(trimmedEmail);
    if (existing) {
      throw new Error(`A user with email "${trimmedEmail}" already exists.`);
    }

    // 2. Hash password
    const passwordHash = await this.hashPassword(params.password);

    // 3. Insert into database
    const insertQuery = `
      INSERT INTO users (name, email, password_hash, role)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, email, role, created_at, updated_at;
    `;

    const result = await pool.query(insertQuery, [params.name.trim(), trimmedEmail, passwordHash, role]);
    const created = result.rows[0] as UserRecord;

    logger.info(`Admin user successfully created with ID: ${created.id}`);

    return this.sanitizeUser(created);
  }
}
