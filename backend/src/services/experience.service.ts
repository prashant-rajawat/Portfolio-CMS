import { getDbPool } from '../db/index.ts';
import { ExperienceRecord } from '../types/cms.ts';
import { CreateExperienceInput, UpdateExperienceInput } from '../validators/experience.validator.ts';
import { NotFoundError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class ExperienceService {
  /**
   * Retrieves all experience entries ordered by display_order ascending, then start_date descending.
   */
  public static async getAll(): Promise<ExperienceRecord[]> {
    const pool = getDbPool();
    if (!pool) {
      return [];
    }

    const query = `
      SELECT id, company, position, description, start_date, end_date, is_current, display_order, created_at, updated_at
      FROM experience
      ORDER BY display_order ASC, start_date DESC;
    `;

    try {
      const result = await pool.query(query);
      return result.rows as ExperienceRecord[];
    } catch {
      return [];
    }
  }

  /**
   * Retrieves a single experience record by ID.
   */
  public static async getById(id: string): Promise<ExperienceRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, company, position, description, start_date, end_date, is_current, display_order, created_at, updated_at
      FROM experience
      WHERE id = $1
      LIMIT 1;
    `;

    try {
      const result = await pool.query(query, [id]);
      if (result.rows.length === 0) return null;
      return result.rows[0] as ExperienceRecord;
    } catch {
      return null;
    }
  }

  /**
   * Creates a new experience entry.
   */
  public static async create(data: CreateExperienceInput): Promise<ExperienceRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      INSERT INTO experience (company, position, description, start_date, end_date, is_current, display_order)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING id, company, position, description, start_date, end_date, is_current, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      data.company,
      data.position,
      data.description,
      data.start_date,
      data.is_current ? null : (data.end_date ?? null),
      data.is_current ?? false,
      data.display_order ?? 0,
    ]);

    logger.info(`Created experience record: ${data.company} - ${data.position}`);
    return result.rows[0] as ExperienceRecord;
  }

  /**
   * Updates an existing experience entry.
   */
  public static async update(id: string, data: UpdateExperienceInput): Promise<ExperienceRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Experience entry with ID "${id}" was not found.`);
    }

    const updatedCompany = data.company ?? current.company;
    const updatedPosition = data.position ?? current.position;
    const updatedDescription = data.description ?? current.description;
    const updatedStartDate = data.start_date ?? current.start_date;
    const updatedIsCurrent = data.is_current !== undefined ? data.is_current : current.is_current;
    const updatedEndDate = updatedIsCurrent ? null : (data.end_date !== undefined ? data.end_date : current.end_date);
    const updatedDisplayOrder = data.display_order !== undefined ? data.display_order : current.display_order;

    const query = `
      UPDATE experience
      SET company = $1,
          position = $2,
          description = $3,
          start_date = $4,
          end_date = $5,
          is_current = $6,
          display_order = $7,
          updated_at = NOW()
      WHERE id = $8
      RETURNING id, company, position, description, start_date, end_date, is_current, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      updatedCompany,
      updatedPosition,
      updatedDescription,
      updatedStartDate,
      updatedEndDate,
      updatedIsCurrent,
      updatedDisplayOrder,
      id,
    ]);

    logger.info(`Updated experience entry: ${updatedCompany} (${id})`);
    return result.rows[0] as ExperienceRecord;
  }

  /**
   * Deletes an experience entry by ID.
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `DELETE FROM experience WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Experience entry with ID "${id}" was not found.`);
    }

    logger.info(`Deleted experience entry with ID: ${id}`);
    return { id };
  }
}
