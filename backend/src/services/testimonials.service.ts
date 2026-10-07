import { getDbPool } from '../db/index.ts';
import { TestimonialRecord } from '../types/cms.ts';
import { CreateTestimonialInput, UpdateTestimonialInput } from '../validators/testimonials.validator.ts';
import { NotFoundError, DatabaseNotConfiguredError } from '../utils/errors.ts';
import { logger } from '../utils/logger.ts';

export class TestimonialsService {
  /**
   * Retrieves all testimonials ordered by display_order ascending, then created_at descending.
   */
  public static async getAll(): Promise<TestimonialRecord[]> {
    const pool = getDbPool();
    if (!pool) {
      logger.warn('Database pool not available when fetching testimonials');
      return [];
    }

    const query = `
      SELECT id, name, role, company, content, profile_image_url, display_order, created_at, updated_at
      FROM testimonials
      ORDER BY display_order ASC, created_at DESC;
    `;

    const result = await pool.query(query);
    return result.rows as TestimonialRecord[];
  }

  /**
   * Retrieves a single testimonial by ID.
   */
  public static async getById(id: string): Promise<TestimonialRecord | null> {
    const pool = getDbPool();
    if (!pool) return null;

    const query = `
      SELECT id, name, role, company, content, profile_image_url, display_order, created_at, updated_at
      FROM testimonials
      WHERE id = $1
      LIMIT 1;
    `;

    const result = await pool.query(query, [id]);
    if (result.rows.length === 0) return null;
    return result.rows[0] as TestimonialRecord;
  }

  /**
   * Creates a new testimonial.
   */
  public static async create(data: CreateTestimonialInput): Promise<TestimonialRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `
      INSERT INTO testimonials (name, role, company, content, profile_image_url, display_order)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, name, role, company, content, profile_image_url, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      data.name,
      data.role,
      data.company ?? null,
      data.content,
      data.profile_image_url ?? null,
      data.display_order ?? 0,
    ]);

    logger.info(`Created testimonial from: ${data.name}`);
    return result.rows[0] as TestimonialRecord;
  }

  /**
   * Updates an existing testimonial.
   */
  public static async update(id: string, data: UpdateTestimonialInput): Promise<TestimonialRecord> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const current = await this.getById(id);
    if (!current) {
      throw new NotFoundError(`Testimonial with ID "${id}" was not found.`);
    }

    const updatedName = data.name ?? current.name;
    const updatedRole = data.role ?? current.role;
    const updatedCompany = data.company !== undefined ? data.company : current.company;
    const updatedContent = data.content ?? current.content;
    const updatedImage = data.profile_image_url !== undefined ? data.profile_image_url : current.profile_image_url;
    const updatedDisplayOrder = data.display_order !== undefined ? data.display_order : current.display_order;

    const query = `
      UPDATE testimonials
      SET name = $1,
          role = $2,
          company = $3,
          content = $4,
          profile_image_url = $5,
          display_order = $6,
          updated_at = NOW()
      WHERE id = $7
      RETURNING id, name, role, company, content, profile_image_url, display_order, created_at, updated_at;
    `;

    const result = await pool.query(query, [
      updatedName,
      updatedRole,
      updatedCompany,
      updatedContent,
      updatedImage,
      updatedDisplayOrder,
      id,
    ]);

    logger.info(`Updated testimonial for: ${updatedName} (${id})`);
    return result.rows[0] as TestimonialRecord;
  }

  /**
   * Deletes a testimonial by ID.
   */
  public static async delete(id: string): Promise<{ id: string }> {
    const pool = getDbPool();
    if (!pool) {
      throw new DatabaseNotConfiguredError();
    }

    const query = `DELETE FROM testimonials WHERE id = $1 RETURNING id;`;
    const result = await pool.query(query, [id]);

    if (result.rowCount === 0) {
      throw new NotFoundError(`Testimonial with ID "${id}" was not found.`);
    }

    logger.info(`Deleted testimonial with ID: ${id}`);
    return { id };
  }
}
