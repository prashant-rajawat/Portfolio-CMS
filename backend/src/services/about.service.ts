import { getDbPool, markDatabaseError } from '../db/index.ts';
import { AboutRecord } from '../types/cms.ts';
import { UpdateAboutInput } from '../validators/about.validator.ts';
import { logger } from '../utils/logger.ts';
import { FallbackStore } from './fallbackStore.ts';

export class AboutService {
  public static async getAbout(): Promise<AboutRecord | null> {
    const pool = getDbPool();
    if (pool) {
      try {
        const query = `
          SELECT id, title, short_description, full_description, profile_image_url, resume_url, created_at, updated_at
          FROM about
          ORDER BY created_at ASC
          LIMIT 1;
        `;
        const result = await pool.query(query);
        if (result.rows.length > 0) {
          return result.rows[0] as AboutRecord;
        }
      } catch (err) {
        markDatabaseError();
        logger.debug('PostgreSQL about query unavailable, using local store');
      }
    }

    const store = FallbackStore.readStore();
    return store.about && store.about.length > 0 ? store.about[0] as AboutRecord : null;
  }

  public static async upsertAbout(data: UpdateAboutInput): Promise<AboutRecord> {
    const pool = getDbPool();
    if (pool) {
      try {
        const existingResult = await pool.query('SELECT id FROM about ORDER BY created_at ASC LIMIT 1;');
        if (existingResult.rows.length > 0) {
          const existingId = existingResult.rows[0].id;
          const updateQuery = `
            UPDATE about
            SET title = $1, short_description = $2, full_description = $3, profile_image_url = $4, resume_url = $5, updated_at = NOW()
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
          if (updateResult.rows[0]) {
            const updated = updateResult.rows[0] as AboutRecord;
            const store = FallbackStore.readStore();
            store.about = [updated];
            FallbackStore.writeStore(store);
            return updated;
          }
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
          if (insertResult.rows[0]) {
            const inserted = insertResult.rows[0] as AboutRecord;
            const store = FallbackStore.readStore();
            store.about = [inserted];
            FallbackStore.writeStore(store);
            return inserted;
          }
        }
      } catch (err) {
        markDatabaseError();
        logger.debug('PostgreSQL about upsert unavailable, using local store');
      }
    }

    const store = FallbackStore.readStore();
    const existing = store.about && store.about.length > 0 ? store.about[0] : null;
    const updatedRecord: AboutRecord = {
      id: existing?.id || `about_${Date.now()}`,
      title: data.title,
      short_description: data.short_description,
      full_description: data.full_description,
      profile_image_url: data.profile_image_url ?? null,
      resume_url: data.resume_url ?? null,
      created_at: existing?.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    store.about = [updatedRecord];
    FallbackStore.writeStore(store);
    return updatedRecord;
  }
}
