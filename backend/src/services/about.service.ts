import { getDbPool } from '../db/index.ts';
import { AboutRecord } from '../types/cms.ts';
import { UpdateAboutInput } from '../validators/about.validator.ts';
import { DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class AboutService {
  /**
   * Retrieves the portfolio About profile.
   * Returns null if no about record exists.
   */
  public static async getAbout(): Promise<AboutRecord | null> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when fetching about record');
      return null;
    }

    const query = `
      SELECT id, title, short_description, full_description, profile_image_url, resume_url, created_at, updated_at
      FROM about
      ORDER BY created_at ASC
      LIMIT 1;
    `;

    const result = await pool.query(query);
    if (result.rows.length === 0) {
      return null;
    }

    return result.rows[0] as AboutRecord;
  }

  /**
   * Upserts the portfolio About profile (single content section).
   * If a record exists, updates it. If not, creates the initial record.
   */
  public static async upsertAbout(data: UpdateAboutInput): Promise<AboutRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const existingResult = await pool.query('SELECT id FROM about ORDER BY created_at ASC LIMIT 1;');

    if (existingResult.rows.length > 0) {
      const existingId = existingResult.rows[0].id;
      const updateQuery = `
        UPDATE about
        SET title = $1,
            short_description = $2,
            full_description = $3,
            profile_image_url = $4,
            resume_url = $5,
            updated_at = NOW()
        WHERE id = $6
        RETURNING id, title, short_description, full_description, profile_image_url, resume_url, created_at, updated_at;
      `;

      const updateResult = await pool.query(updateQuery, [
        data.title,
        data.short_description,
        data.full_description,
        data.profile_image_url ?? null,
        data.resume_url ?? null,
        existingId,
      ]);

      logger.info(`Updated existing About profile (${existingId})`);
      return updateResult.rows[0] as AboutRecord;
    } else {
      const insertQuery = `
        INSERT INTO about (title, short_description, full_description, profile_image_url, resume_url)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id, title, short_description, full_description, profile_image_url, resume_url, created_at, updated_at;
      `;

      const insertResult = await pool.query(insertQuery, [
        data.title,
        data.short_description,
        data.full_description,
        data.profile_image_url ?? null,
        data.resume_url ?? null,
      ]);

      logger.info(`Created initial About profile (${insertResult.rows[0].id})`);
      return insertResult.rows[0] as AboutRecord;
    }
  }
}
