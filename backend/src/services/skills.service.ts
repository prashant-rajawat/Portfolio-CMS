import { getDbPool } from '../db/index.ts';
import { SkillRecord } from '../types/cms.ts';
import { CreateSkillInput, UpdateSkillInput } from '../validators/skills.validator.ts';
import { NotFoundError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class SkillsService {
  /**
   * Retrieves all skills ordered by display_order ascending.
   */
  public static async getAll(): Promise<SkillRecord[]> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when fetching skills');
      return [];
    }

    const query = `
      SELECT id, name, category, proficiency, icon_url, display_order, created_at, updated_at
      FROM skills
      ORDER BY display_order ASC, created_at ASC;
    `;

    const result = await pool.query(query);
    return result.rows as SkillRecord[];
  }

  /**
   * Retrieves a single skill by ID.
   */
  public static async getById(id: string): Promise<SkillRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, name, category, proficiency, icon_url, display_order, created_at, updated_at
      FROM skills
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as SkillRecord;
  }

  /**
   * Creates a new skill entry.
   */
  public static async create(data: CreateSkillInput): Promise<SkillRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      INSERT INTO skills (name, category, proficiency, icon_url, display_order)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, category, proficiency, icon_url, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      data.name,
      data.category,
      data.proficiency ?? null,
      data.icon_url ?? null,
      data.display_order ?? 0,
    ]);

    logger.info(`Created new skill: ${data.name} (ID: ${result.rows[0].id})`);
    return result.rows[0] as SkillRecord;
  }

  /**
   * Updates an existing skill entry.
   */
  public static async update(id: string, data: UpdateSkillInput): Promise<SkillRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Skill with ID "${id}" was not found.`);
    }

    const updatedName = data.name ?? current.name;
    const updatedCategory = data.category ?? current.category;
    const updatedProficiency = data.proficiency !== undefined ? data.proficiency : current.proficiency;
    const updatedIconUrl = data.icon_url !== undefined ? data.icon_url : current.icon_url;
    const updatedDisplayOrder = data.display_order !== undefined ? data.display_order : current.display_order;

    const query = `
      UPDATE skills
      SET name = $1,
          category = $2,
          proficiency = $3,
          icon_url = $4,
          display_order = $5,
          updated_at = NOW()
      WHERE id = $6
      RETURNING id, name, category, proficiency, icon_url, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      updatedName,
      updatedCategory,
      updatedProficiency,
      updatedIconUrl,
      updatedDisplayOrder,
      id,
    ]);

    logger.info(`Updated skill: ${updatedName} (ID: ${id})`);
    return result.rows[0] as SkillRecord;
  }

  /**
   * Deletes a skill entry by ID.
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `DELETE FROM skills WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Skill with ID "${id}" was not found.`);
    }

    logger.info(`Deleted skill with ID: ${id}`);
    return { id };
  }
}
