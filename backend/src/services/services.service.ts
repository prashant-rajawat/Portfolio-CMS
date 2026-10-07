import { getDbPool } from '../db/index.ts';
import { ServiceRecord } from '../types/cms.ts';
import { CreateServiceInput, UpdateServiceInput } from '../validators/services.validator.ts';
import { NotFoundError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class ServicesService {
  /**
   * Retrieves all services ordered by display_order ascending, then created_at ascending.
   */
  public static async getAll(): Promise<ServiceRecord[]> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when fetching services');
      return [];
    }

    const query = `
      SELECT id, title, description, icon_url, display_order, created_at, updated_at
      FROM services
      ORDER BY display_order ASC, created_at ASC;
    `;

    const result = await pool.query(query);
    return result.rows as ServiceRecord[];
  }

  /**
   * Retrieves a single service by ID.
   */
  public static async getById(id: string): Promise<ServiceRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, title, description, icon_url, display_order, created_at, updated_at
      FROM services
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as ServiceRecord;
  }

  /**
   * Creates a new service offering.
   */
  public static async create(data: CreateServiceInput): Promise<ServiceRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      INSERT INTO services (title, description, icon_url, display_order)
      VALUES ($1, $2, $3, $4)
      RETURNING id, title, description, icon_url, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      data.title,
      data.description,
      data.icon_url ?? null,
      data.display_order ?? 0,
    ]);

    logger.info(`Created service offering: ${data.title}`);
    return result.rows[0] as ServiceRecord;
  }

  /**
   * Updates an existing service offering.
   */
  public static async update(id: string, data: UpdateServiceInput): Promise<ServiceRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Service with ID "${id}" was not found.`);
    }

    const updatedTitle = data.title ?? current.title;
    const updatedDescription = data.description ?? current.description;
    const updatedIcon = data.icon_url !== undefined ? data.icon_url : current.icon_url;
    const updatedDisplayOrder = data.display_order !== undefined ? data.display_order : current.display_order;

    const query = `
      UPDATE services
      SET title = $1,
          description = $2,
          icon_url = $3,
          display_order = $4,
          updated_at = NOW()
      WHERE id = $5
      RETURNING id, title, description, icon_url, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      updatedTitle,
      updatedDescription,
      updatedIcon,
      updatedDisplayOrder,
      id,
    ]);

    logger.info(`Updated service: ${updatedTitle} (${id})`);
    return result.rows[0] as ServiceRecord;
  }

  /**
   * Deletes a service offering by ID.
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `DELETE FROM services WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Service with ID "${id}" was not found.`);
    }

    logger.info(`Deleted service with ID: ${id}`);
    return { id };
  }
}
